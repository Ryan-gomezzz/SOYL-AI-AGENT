#!/usr/bin/env bash
# Provision Twilio Webhook URL
# Updates the webhook URL for a Twilio phone number

set -e

ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
AUTH="${TWILIO_AUTH_TOKEN}"

if [ -z "$ACCOUNT_SID" ] || [ -z "$AUTH" ]; then
  echo "Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set"
  exit 1
fi

PHONE_SID="${1}"
WEBHOOK_URL="${2}"

if [ -z "$PHONE_SID" ] || [ -z "$WEBHOOK_URL" ]; then
  echo "Usage: $0 <phone_sid> <webhook_url>"
  echo "Example: $0 PN1234567890abcdef https://api.example.com/twilio/webhook"
  echo ""
  echo "To find your phone SID, list numbers:"
  echo "  curl -u \"\$TWILIO_ACCOUNT_SID:\$TWILIO_AUTH_TOKEN\" \\"
  echo "    https://api.twilio.com/2010-04-01/Accounts/\$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json | jq"
  exit 1
fi

echo "Updating webhook for phone SID: $PHONE_SID"
echo "Webhook URL: $WEBHOOK_URL"

RESPONSE=$(curl -X POST "https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers/${PHONE_SID}.json" \
  -u "${ACCOUNT_SID}:${AUTH}" \
  --data-urlencode "VoiceUrl=${WEBHOOK_URL}" \
  --data-urlencode "VoiceMethod=POST" \
  --data-urlencode "SmsUrl=${WEBHOOK_URL}/sms" \
  --data-urlencode "SmsMethod=POST")

PHONE_NUMBER=$(echo "$RESPONSE" | jq -r '.phone_number')

if [ "$PHONE_NUMBER" != "null" ] && [ -n "$PHONE_NUMBER" ]; then
  echo "✅ Webhook updated successfully!"
  echo "Phone Number: $PHONE_NUMBER"
  echo "Voice Webhook: $WEBHOOK_URL"
else
  echo "❌ Failed to update webhook"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

