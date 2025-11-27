# Integration Guide - Twilio Voice

This document describes the Twilio Voice integration with our AWS backend.

## Overview

Twilio Voice provides telephony services via webhooks. When a call comes in or goes out, Twilio sends HTTP POST requests to our API Gateway endpoint, which invokes a Lambda function that processes the call and returns TwiML (Twilio Markup Language) instructions.

## Architecture Flow

```
[Caller / PSTN] <---> Twilio Phone Number
                     |
                     | Twilio Webhook (HTTP POST)
                     |
                     ▼
              API Gateway (HTTPS)
                     |
                     ▼
            Lambda (twilio-webhook)
                     |
        [Auth/Sign-check | Parse | Business logic]
                     |
            -> AI Agent (VAPI or in-house model) <-- optional DB
                     |
            Return TwiML or stream audio
                     |
                  Twilio (plays audio / connects call)
                     |
        (Recordings -> S3 ; Logs -> CloudWatch)
```

## Inbound Call Flow

1. **Caller dials Twilio number**
   - Twilio receives the call

2. **Twilio posts call event to webhook**
   - POST to `https://<api-gateway-url>/twilio/webhook`
   - Headers: `X-Twilio-Signature` (for validation)
   - Body: `application/x-www-form-urlencoded` with call parameters

3. **API Gateway receives request**
   - Routes to Lambda function: `twilio-webhook`

4. **Lambda processes webhook**
   - Validates `X-Twilio-Signature` header
   - Extracts call information (CallSid, From, To, etc.)
   - Optionally looks up contact in database
   - Calls AI agent (VAPI) for response
   - Returns TwiML XML

5. **Twilio executes TwiML**
   - Plays text-to-speech
   - Gathers DTMF input (if configured)
   - Records call (if configured)
   - Connects to agent (if needed)

6. **Recording webhook** (after call ends)
   - Twilio posts recording URL to webhook
   - Lambda stores recording metadata in database
   - Recording file is available in S3 (if configured)

## Outbound Call Flow

1. **Backend initiates outbound call**
   ```bash
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Calls.json" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
     --data-urlencode "From=+91XXXXXXXXXX" \
     --data-urlencode "To=+91YYYYYYYYYY" \
     --data-urlencode "Url=https://<api-gateway-url>/twilio/webhook"
   ```

2. **Twilio calls the destination**
   - When answered, Twilio calls the `Url` webhook

3. **Webhook returns TwiML**
   - Same flow as inbound call
   - Lambda generates response based on call context

4. **Call recording and processing**
   - Same as inbound call flow

## Webhook Payload Example

### Inbound Call Webhook

```http
POST /twilio/webhook HTTP/1.1
Host: api.example.com
Content-Type: application/x-www-form-urlencoded
X-Twilio-Signature: RSOYDt6T1+UTPZLD0lzjeLmi/bg=

CallSid=CA1234567890abcdef&
From=%2B911234567890&
To=%2B919876543210&
CallStatus=ringing&
Direction=inbound
```

### TwiML Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en">
    Hello, how can I help you today?
  </Say>
  <Gather action="/twilio/gather" method="POST" numDigits="1">
    <Say>Press 1 to continue, press 2 to speak to an agent.</Say>
  </Gather>
  <Record maxLength="30" action="/twilio/recording" />
</Response>
```

## Lambda Handler Code Example

See `infra/lambda/twilio-webhook/handler.js` for the complete implementation.

Key features:
- Signature validation using `X-Twilio-Signature`
- TwiML generation
- AI agent integration (optional)
- Recording webhook handling
- DTMF input handling

## Security

### Signature Validation

All webhooks must validate the `X-Twilio-Signature` header to ensure requests are from Twilio:

```javascript
function validateTwilioSignature(url, params, signature) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('');
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
```

### HTTPS Only

- API Gateway provides TLS termination
- Webhook URLs must use HTTPS
- Twilio requires valid SSL certificates

### Secrets Management

- Store `TWILIO_AUTH_TOKEN` in AWS Secrets Manager
- Never commit credentials to version control
- Use CI/CD secrets for deployment

## Testing

### Local Testing

Use Twilio test credentials and magic phone numbers:

```bash
# Test webhook locally with ngrok
ngrok http 3000

# Update Twilio webhook to ngrok URL
./scripts/twilio/provision_webhook.sh <PHONE_SID> https://abc123.ngrok.io/twilio/webhook
```

### Integration Tests

See `tests/integration/twilio-webhook.test.js` for examples.

## Rate Limits

Twilio has rate limits based on your account type:
- **Free Trial**: Limited calls per month
- **Pay-as-you-go**: Based on usage
- **Enterprise**: Custom limits

Check Twilio Console for your account limits.

## Error Handling

The Lambda handler includes error handling for:
- Invalid signatures (403)
- Missing parameters (400)
- AI agent failures (fallback to default message)
- Network timeouts (5 second timeout for AI calls)

All errors are logged to CloudWatch.

## Monitoring

- **CloudWatch Logs**: Lambda execution logs
- **CloudWatch Metrics**: Custom metrics for call processing
- **Twilio Console**: Call logs and analytics
- **S3**: Recording files and metadata

## References

- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)
- [Webhook Security](https://www.twilio.com/docs/usage/security#validating-requests)
- [Twilio Test Credentials](https://www.twilio.com/docs/iam/test-credentials)

