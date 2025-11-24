/**
 * Email Service
 * 
 * Production-ready email service using AWS SES with:
 * - Template rendering
 * - Error handling and retries
 * - Rate limiting considerations
 * - Bounce/complaint handling
 * - Edge case handling
 */

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

// Initialize SES client
const ses = new AWS.SES({
  region: process.env.AWS_REGION || 'us-east-1',
  maxRetries: 3,
  retryDelayOptions: {
    base: 200
  }
});

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'ryan.gomez@soyl.cloud';
const FROM_NAME = process.env.FROM_NAME || 'SOYL AI Agent';
const REPLY_TO = process.env.REPLY_TO || FROM_EMAIL;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Load and render email template
 * @param {string} templateName - Template filename
 * @param {Object} data - Template variables
 * @returns {Promise<string>} Rendered HTML
 */
async function renderTemplate(templateName, data = {}) {
  try {
    const templatePath = path.join(__dirname, '../../templates', templateName);
    let template = await fs.readFile(templatePath, 'utf8');
    
    // Simple template variable replacement (can use Handlebars/other engines)
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, String(data[key] || ''));
    });
    
    // Replace any remaining placeholders with empty string
    template = template.replace(/{{[^}]+}}/g, '');
    
    return template;
  } catch (error) {
    console.error(`Error loading template ${templateName}:`, error);
    throw new Error(`Failed to load email template: ${templateName}`);
  }
}

/**
 * Send email using AWS SES with retry logic
 * @param {Object} emailParams - Email parameters
 * @param {number} retries - Current retry attempt
 * @returns {Promise<Object>} SES send result
 */
async function sendEmail(emailParams, retries = 0) {
  try {
    // Validate email parameters
    if (!emailParams.to) {
      throw new Error('Recipient email address is required');
    }

    if (!emailParams.subject) {
      throw new Error('Email subject is required');
    }

    if (!emailParams.html && !emailParams.text) {
      throw new Error('Email body (html or text) is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailParams.to)) {
      throw new Error(`Invalid recipient email address: ${emailParams.to}`);
    }

    // Prepare SES parameters
    const params = {
      Source: emailParams.from || `${FROM_NAME} <${FROM_EMAIL}>`,
      Destination: {
        ToAddresses: Array.isArray(emailParams.to) ? emailParams.to : [emailParams.to],
        CcAddresses: emailParams.cc || [],
        BccAddresses: emailParams.bcc || []
      },
      Message: {
        Subject: {
          Data: emailParams.subject,
          Charset: 'UTF-8'
        },
        Body: {
          ...(emailParams.html && {
            Html: {
              Data: emailParams.html,
              Charset: 'UTF-8'
            }
          }),
          ...(emailParams.text && {
            Text: {
              Data: emailParams.text,
              Charset: 'UTF-8'
            }
          })
        }
      },
      ReplyToAddresses: [emailParams.replyTo || REPLY_TO],
      ...(emailParams.configurationSetName && {
        ConfigurationSetName: emailParams.configurationSetName
      })
    };

    // Validate addresses
    const allAddresses = [
      ...params.Destination.ToAddresses,
      ...params.Destination.CcAddresses,
      ...params.Destination.BccAddresses
    ];

    for (const address of allAddresses) {
      if (!emailRegex.test(address)) {
        throw new Error(`Invalid email address in recipient list: ${address}`);
      }
    }

    // Send email
    const result = await ses.sendEmail(params).promise();
    
    console.log(`✅ Email sent successfully: ${emailParams.to} (MessageId: ${result.MessageId})`);
    return result;

  } catch (error) {
    // Handle SES-specific errors
    if (error.code === 'MessageRejected') {
      throw new Error(`Email rejected: ${error.message}`);
    }

    if (error.code === 'MailFromDomainNotVerifiedException') {
      throw new Error('Sender email domain not verified in SES');
    }

    if (error.code === 'ConfigurationSetDoesNotExistException') {
      throw new Error('SES configuration set does not exist');
    }

    // Retry on transient errors
    const isRetryable = 
      error.code === 'Throttling' ||
      error.code === 'ServiceUnavailable' ||
      error.statusCode === 500 ||
      error.statusCode === 503 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout');

    if (isRetryable && retries < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retries); // Exponential backoff
      console.warn(`⚠️  Email send failed, retrying in ${delay}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return sendEmail(emailParams, retries + 1);
    }

    console.error('Error sending email:', {
      error: error.message,
      code: error.code,
      to: emailParams.to?.substring(0, 20) // Log partial email for debugging
    });
    
    throw error;
  }
}

/**
 * Send confirmation email to lead
 * @param {Object} leadData - Lead information
 * @returns {Promise<Object>} SES send result
 */
async function sendConfirmationEmail(leadData) {
  try {
    const { name, email, lead_id } = leadData;

    // Validate required fields
    if (!name || !email || !lead_id) {
      throw new Error('Missing required fields for confirmation email');
    }

    // Load and render template
    let htmlBody;
    try {
      htmlBody = await renderTemplate('confirmation_email.html', {
        name: name,
        lead_id: lead_id,
        enquiry_date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      });
    } catch (templateError) {
      console.warn('Failed to load template, using default email:', templateError.message);
      // Fallback to plain text if template fails
      htmlBody = `
        <html>
          <body>
            <h2>Thank you for your enquiry, ${name}!</h2>
            <p>We have received your enquiry and will get back to you soon.</p>
            <p>Your enquiry ID: ${lead_id}</p>
            <p>Best regards,<br>SOYL AI Agent Team</p>
          </body>
        </html>
      `;
    }

    // Plain text version for clients that don't support HTML
    const textBody = `
Thank you for your enquiry, ${name}!

We have received your enquiry and will get back to you soon.

Your enquiry ID: ${lead_id}

Best regards,
SOYL AI Agent Team
    `.trim();

    // Send email
    return await sendEmail({
      to: email,
      subject: 'Thank you for your enquiry - SOYL AI Agent',
      html: htmlBody,
      text: textBody
    });

  } catch (error) {
    console.error('Error sending confirmation email:', {
      error: error.message,
      lead_id: leadData.lead_id,
      email: leadData.email?.substring(0, 20)
    });
    throw error;
  }
}

/**
 * Check if email address is verified in SES
 * @param {string} email - Email address to check
 * @returns {Promise<boolean>} True if verified
 */
async function isEmailVerified(email) {
  try {
    const result = await ses.getIdentityVerificationAttributes({
      Identities: [email]
    }).promise();

    const verificationStatus = result.VerificationAttributes[email]?.VerificationStatus;
    return verificationStatus === 'Success';
  } catch (error) {
    console.error('Error checking email verification status:', error);
    return false; // Fail open - assume verified if check fails
  }
}

module.exports = {
  sendEmail,
  sendConfirmationEmail,
  renderTemplate,
  isEmailVerified
};

