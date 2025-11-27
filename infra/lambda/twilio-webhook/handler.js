/**
 * Twilio Webhook Lambda Handler
 * 
 * Handles inbound and outbound call webhooks from Twilio
 * Validates X-Twilio-Signature and returns TwiML responses
 * 
 * Environment Variables:
 * - TWILIO_AUTH_TOKEN: Twilio auth token for signature validation
 * - VAPI_ENDPOINT: AI agent endpoint (optional)
 * - VAPI_API_KEY: API key for AI agent (optional)
 * - WEBHOOK_FULL_URL: Full webhook URL for signature validation
 */

const crypto = require('crypto');
const querystring = require('querystring');
const axios = require('axios');

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VAPI_ENDPOINT = process.env.VAPI_ENDPOINT; // your AI endpoint
const VAPI_KEY = process.env.VAPI_API_KEY;
const WEBHOOK_FULL_URL = process.env.WEBHOOK_FULL_URL;

/**
 * Validate Twilio webhook signature
 * @param {string} url - Full webhook URL
 * @param {object} params - Request parameters
 * @param {string} signature - X-Twilio-Signature header
 * @returns {boolean} True if signature is valid
 */
function validateTwilioSignature(url, params, signature) {
  if (!TWILIO_AUTH_TOKEN || !signature) {
    return false;
  }

  // Follow Twilio signature validation: https://www.twilio.com/docs/usage/security#validating-requests
  // Sort parameters and concatenate key=value pairs
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('');

  // Create HMAC-SHA1 hash
  const data = url + sortedParams;
  const expected = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(data)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Escape XML special characters
 * @param {string} unsafe - String to escape
 * @returns {string} Escaped string
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate TwiML response
 * @param {string} sayText - Text to say
 * @param {object} options - Additional options
 * @returns {string} TwiML XML
 */
function generateTwiML(sayText, options = {}) {
  const {
    record = false,
    recordAction = '/twilio/recording',
    gather = false,
    gatherAction = '/twilio/gather',
    voice = 'Polly.Joanna',
    language = 'en'
  } = options;

  let twiml = '<Response>';
  
  if (sayText) {
    twiml += `<Say voice="${voice}" language="${language}">${escapeXml(sayText)}</Say>`;
  }

  if (gather) {
    twiml += `<Gather action="${gatherAction}" method="POST" numDigits="1">
      <Say>Press 1 to continue, press 2 to speak to an agent.</Say>
    </Gather>`;
  }

  if (record) {
    twiml += `<Record maxLength="30" action="${recordAction}" recordingStatusCallback="${recordAction}/status" />`;
  }

  twiml += '</Response>';
  return twiml;
}

/**
 * Lambda handler for Twilio webhooks
 */
exports.handler = async (event) => {
  try {
    // Get webhook URL (use environment variable or construct from event)
    const url = WEBHOOK_FULL_URL || 
      `https://${event.requestContext?.domainName || 'api.example.com'}${event.path || '/twilio/webhook'}`;

    // Twilio sends application/x-www-form-urlencoded for voice events
    const body = event.body || '';
    const params = querystring.parse(body);
    
    // Get signature from headers
    const signature = event.headers['X-Twilio-Signature'] || 
                     event.headers['x-twilio-signature'] || 
                     '';

    // Validate signature
    if (!validateTwilioSignature(url, params, signature)) {
      console.error('Invalid Twilio signature', {
        url,
        hasSignature: !!signature,
        params: Object.keys(params)
      });
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'text/plain' },
        body: 'Invalid signature'
      };
    }

    // Extract call information
    const callSid = params.CallSid;
    const from = params.From;
    const to = params.To;
    const callStatus = params.CallStatus;
    const speechResult = params.SpeechResult || null;
    const digits = params.Digits || null;

    console.log('Twilio webhook received', {
      callSid,
      from,
      to,
      callStatus,
      hasSpeechResult: !!speechResult,
      hasDigits: !!digits
    });

    // Handle different webhook types
    if (params.RecordingUrl) {
      // Recording webhook
      const recordingSid = params.RecordingSid;
      const recordingUrl = params.RecordingUrl;
      const recordingStatus = params.RecordingStatus;
      
      console.log('Recording webhook', {
        recordingSid,
        recordingUrl,
        recordingStatus,
        callSid
      });

      // TODO: Store recording URL in database
      // await storeRecording(callSid, recordingSid, recordingUrl);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: '<Response></Response>'
      };
    }

    // Handle DTMF input
    if (digits) {
      if (digits === '1') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/xml' },
          body: generateTwiML('Thank you for continuing. How can I help you today?', {
            record: true
          })
        };
      } else if (digits === '2') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/xml' },
          body: generateTwiML('Please hold while we connect you to an agent.')
        };
      }
    }

    // Call AI agent (VAPI) for response text
    let sayText = "Hello, how can I help you?";
    
    if (VAPI_ENDPOINT && VAPI_KEY) {
      try {
        const aiResp = await axios.post(
          VAPI_ENDPOINT,
          {
            callSid,
            from,
            to,
            transcript: speechResult,
            callStatus
          },
          {
            headers: {
              'Authorization': `Bearer ${VAPI_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000 // 5 second timeout
          }
        );

        sayText = aiResp.data?.reply || aiResp.data?.response || sayText;
      } catch (aiError) {
        console.error('AI agent call failed', {
          error: aiError.message,
          callSid
        });
        // Fallback to default message
      }
    }

    // Generate TwiML response
    const twiml = generateTwiML(sayText, {
      record: true,
      gather: true
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: twiml
    };

  } catch (err) {
    console.error('Twilio webhook error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/plain' },
      body: 'Internal error'
    };
  }
};

