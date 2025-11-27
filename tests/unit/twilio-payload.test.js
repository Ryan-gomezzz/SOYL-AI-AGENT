/**
 * Twilio Payload Parsing Unit Tests
 * 
 * Tests for parsing Twilio webhook payloads
 */

const querystring = require('querystring');

describe('Twilio Payload Parsing', () => {
  test('should parse inbound call payload', () => {
    const body = 'CallSid=CA123&From=%2B911234567890&To=%2B919876543210&CallStatus=ringing';
    const params = querystring.parse(body);

    expect(params.CallSid).toBe('CA123');
    expect(params.From).toBe('+911234567890');
    expect(params.To).toBe('+919876543210');
    expect(params.CallStatus).toBe('ringing');
  });

  test('should parse outbound call payload', () => {
    const body = 'CallSid=CA456&From=%2B911234567890&To=%2B919876543210&CallStatus=in-progress&Direction=outbound-api';
    const params = querystring.parse(body);

    expect(params.CallSid).toBe('CA456');
    expect(params.Direction).toBe('outbound-api');
  });

  test('should parse DTMF input', () => {
    const body = 'CallSid=CA789&Digits=1&CallStatus=in-progress';
    const params = querystring.parse(body);

    expect(params.Digits).toBe('1');
  });

  test('should parse recording webhook', () => {
    const body = 'CallSid=CA123&RecordingSid=RE456&RecordingUrl=https://api.twilio.com/...&RecordingStatus=completed';
    const params = querystring.parse(body);

    expect(params.RecordingSid).toBe('RE456');
    expect(params.RecordingStatus).toBe('completed');
    expect(params.RecordingUrl).toContain('twilio.com');
  });

  test('should handle empty payload', () => {
    const body = '';
    const params = querystring.parse(body);

    expect(Object.keys(params).length).toBe(0);
  });

  test('should handle special characters in payload', () => {
    const body = 'CallSid=CA123&From=%2B911234567890&SpeechResult=Hello%20World';
    const params = querystring.parse(body);

    expect(params.SpeechResult).toBe('Hello World');
  });
});

