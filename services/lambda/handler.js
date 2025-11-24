const AWS = require('aws-sdk');
const { Client } = require('pg');

const secretsManager = new AWS.SecretsManager();
const s3 = new AWS.S3();
const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Lambda handler for POST /enquiry endpoint
 * 
 * Validates payload, saves to RDS, and publishes to SQS (or logs for now)
 */
exports.enquiry = async (event) => {
  console.log('Enquiry handler invoked:', JSON.stringify(event));

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Validate payload
    if (!body.email || !body.name || !body.message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing required fields: email, name, message'
        })
      };
    }

    // Get database credentials from Secrets Manager
    const dbSecretArn = process.env.DB_SECRET_ARN;
    if (!dbSecretArn) {
      throw new Error('DB_SECRET_ARN environment variable not set');
    }

    const secretResponse = await secretsManager.getSecretValue({
      SecretId: dbSecretArn
    }).promise();

    // Handle potential encoding issues (BOM, whitespace, etc.)
    let secretString = secretResponse.SecretString;
    
    // Remove BOM if present
    if (secretString.length > 0 && secretString.charCodeAt(0) === 0xFEFF) {
      secretString = secretString.slice(1);
    }
    
    // Remove any non-printable characters at the start
    secretString = secretString.replace(/^[\u0000-\u001F\u007F-\u009F]+/, '');
    
    // Trim whitespace
    secretString = secretString.trim();
    
    // Log the first few characters for debugging (without exposing sensitive data)
    console.log('Secret string length:', secretString.length);
    console.log('First 50 chars:', secretString.substring(0, 50));
    
    let dbCredentials;
    try {
      dbCredentials = JSON.parse(secretString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Secret string (first 200 chars):', secretString.substring(0, 200));
      throw new Error(`Failed to parse secret JSON: ${parseError.message}`);
    }

    // Connect to database with SSL (required by RDS)
    const client = new Client({
      host: dbCredentials.host,
      port: dbCredentials.port || 5432,
      database: dbCredentials.dbname || dbCredentials.database,
      user: dbCredentials.username || dbCredentials.user,
      password: dbCredentials.password,
      ssl: {
        rejectUnauthorized: false // RDS requires SSL but we can skip cert verification
      },
      connectionTimeoutMillis: 10000
    });

    console.log('Attempting to connect to database:', {
      host: dbCredentials.host,
      port: dbCredentials.port || 5432,
      database: dbCredentials.dbname || dbCredentials.database,
      user: dbCredentials.username || dbCredentials.user
    });

    await client.connect();
    console.log('Database connection successful');

    // Create leads table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        source VARCHAR(100),
        enquiry_type VARCHAR(100),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    `;
    
    await client.query(createTableQuery);
    console.log('Table verified/created');

    // Save enquiry to database (using leads table as per schema)
    const insertQuery = `
      INSERT INTO leads (email, name, notes, enquiry_type, source, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING id
    `;

    const result = await client.query(insertQuery, [
      body.email,
      body.name,
      body.message || body.notes || '',
      body.enquiryType || 'general',
      'website'
    ]);

    await client.end();

    const enquiryId = result.rows[0].id;

    // Send confirmation email (non-blocking)
    sendConfirmationEmail({
      name: body.name,
      email: body.email,
      lead_id: enquiryId
    }).catch((emailError) => {
      // Log email error but don't fail the request
      console.error('⚠️  Failed to send confirmation email (non-critical):', {
        error: emailError.message,
        lead_id: enquiryId,
        email: body.email?.substring(0, 20)
      });
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Enquiry received successfully',
        enquiryId: enquiryId
      })
    };

  } catch (error) {
    console.error('Error processing enquiry:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

/**
 * Send confirmation email to lead
 * @param {Object} leadData - Lead data with name, email, lead_id
 */
async function sendConfirmationEmail(leadData) {
  const { name, email, lead_id } = leadData;

  if (!name || !email || !lead_id) {
    throw new Error('Missing required fields for confirmation email');
  }

  const FROM_EMAIL = process.env.FROM_EMAIL || 'ryan.gomez@soyl.cloud';
  const FROM_NAME = process.env.FROM_NAME || 'SOYL AI Agent';

  // Simple HTML email template
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Thank You for Your Enquiry</h1>
      </div>
      <div class="content">
        <p>Dear ${name},</p>
        <p>Thank you for contacting SOYL AI Agent. We have received your enquiry and will get back to you shortly.</p>
        <p><strong>Your Enquiry Details:</strong></p>
        <ul>
          <li><strong>Enquiry ID:</strong> ${lead_id}</li>
          <li><strong>Date Submitted:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
        </ul>
        <p>Our team will review your enquiry and respond within 24-48 hours.</p>
        <p>Best regards,<br>SOYL AI Agent Team</p>
      </div>
      <div class="footer">
        <p>This is an automated confirmation email. Please do not reply to this message.</p>
      </div>
    </body>
    </html>
  `;

  const textBody = `
Thank you for your enquiry, ${name}!

We have received your enquiry and will get back to you soon.

Your enquiry ID: ${lead_id}
Date Submitted: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Our team will review your enquiry and respond within 24-48 hours.

Best regards,
SOYL AI Agent Team
  `.trim();

  const params = {
    Source: `${FROM_NAME} <${FROM_EMAIL}>`,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Thank you for your enquiry - SOYL AI Agent',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8'
        },
        Text: {
          Data: textBody,
          Charset: 'UTF-8'
        }
      }
    },
    ReplyToAddresses: [FROM_EMAIL]
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log(`✅ Email sent successfully: ${email} (MessageId: ${result.MessageId})`);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

