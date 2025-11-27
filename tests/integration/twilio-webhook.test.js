/**
 * Twilio Webhook Integration Tests
 * 
 * Tests for Twilio webhook signature validation and TwiML generation
 */

const crypto = require('crypto');
const { handler } = require('../../infra/lambda/twilio-webhook/handler');

// Mock environment variables
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token_12345';
process.env.WEBHOOK_FULL_URL = 'https://api.example.com/twilio/webhook';
process.env.VAPI_ENDPOINT = 'https://api.vapi.ai/v1/call';
process.env.VAPI_API_KEY = 'test_vapi_key';

/**
 * Generate valid Twilio signature for testing
 */
function generateTwilioSignature(url, params, authToken) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('');
  const data = url + sortedParams;
  return crypto
    .createHmac('sha1', authToken)
    .update(data)
    .digest('base64');
}

/**
 * Create mock Lambda event
 */
function createMockEvent(body, signature) {
  return {
    body: body,
    headers: {
      'X-Twilio-Signature': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    requestContext: {
      domainName: 'api.example.com'
    },
    path: '/twilio/webhook'
  };
}

describe('Twilio Webhook Handler', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  test('should validate Twilio signature correctly', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210',
      CallStatus: 'ringing'
    };

    const body = new URLSearchParams(params).toString();
    const signature = generateTwilioSignature(
      process.env.WEBHOOK_FULL_URL,
      params,
      process.env.TWILIO_AUTH_TOKEN
    );

    const event = createMockEvent(body, signature);

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('text/xml');
    expect(response.body).toContain('<Response>');
    expect(response.body).toContain('<Say>');
  });

  test('should reject invalid signature', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210',
      CallStatus: 'ringing'
    };

    const body = new URLSearchParams(params).toString();
    const invalidSignature = 'invalid_signature';

    const event = createMockEvent(body, invalidSignature);

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Invalid signature');
  });

  test('should handle missing signature', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210'
    };

    const body = new URLSearchParams(params).toString();
    const event = createMockEvent(body, '');

    const response = await handler(event);

    expect(response.statusCode).toBe(403);
  });

  test('should generate TwiML for inbound call', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210',
      CallStatus: 'ringing',
      Direction: 'inbound'
    };

    const body = new URLSearchParams(params).toString();
    const signature = generateTwilioSignature(
      process.env.WEBHOOK_FULL_URL,
      params,
      process.env.TWILIO_AUTH_TOKEN
    );

    const event = createMockEvent(body, signature);

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<Response>');
    expect(response.body).toContain('<Say');
    expect(response.body).toContain('<Gather');
    expect(response.body).toContain('<Record');
  });

  test('should handle DTMF input', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210',
      CallStatus: 'in-progress',
      Digits: '1'
    };

    const body = new URLSearchParams(params).toString();
    const signature = generateTwilioSignature(
      process.env.WEBHOOK_FULL_URL,
      params,
      process.env.TWILIO_AUTH_TOKEN
    );

    const event = createMockEvent(body, signature);

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Thank you for continuing');
  });

  test('should handle recording webhook', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      RecordingSid: 'RE1234567890abcdef',
      RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/RE...',
      RecordingStatus: 'completed',
      RecordingDuration: '30'
    };

    const body = new URLSearchParams(params).toString();
    const signature = generateTwilioSignature(
      process.env.WEBHOOK_FULL_URL,
      params,
      process.env.TWILIO_AUTH_TOKEN
    );

    const event = createMockEvent(body, signature);

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<Response></Response>');
  });

  test('should handle errors gracefully', async () => {
    const params = {
      CallSid: 'CA1234567890abcdef',
      From: '+911234567890',
      To: '+919876543210'
    };

    const body = new URLSearchParams(params).toString();
    const signature = generateTwilioSignature(
      process.env.WEBHOOK_FULL_URL,
      params,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Create event with invalid structure to trigger error
    const event = {
      ...createMockEvent(body, signature),
      body: null // This will cause an error
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain('Internal error');
  });
});

