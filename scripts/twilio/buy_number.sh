#!/usr/bin/env bash
# Buy Twilio Phone Number
# Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars

set -e

ACCOUNT_SID="${TWILIO_ACCOUNT_SID}"
AUTH="${TWILIO_AUTH_TOKEN}"

if [ -z "$ACCOUNT_SID" ] || [ -z "$AUTH" ]; then
  echo "Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set"
  exit 1
fi

# Example to search & buy a number (India numbers availability varies; use country=IN)
# For India: use country=IN and area code if needed
# For US: use country=US

COUNTRY="${1:-IN}"  # Default to India
AREA_CODE="${2:-}"  # Optional area code

if [ -z "$AREA_CODE" ]; then
  # Search for available numbers
  echo "Searching for available numbers in country: $COUNTRY"
  curl -X GET "https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/AvailablePhoneNumbers/${COUNTRY}/Local.json" \
    -u "${ACCOUNT_SID}:${AUTH}" | jq '.available_phone_numbers[] | {phone_number: .phone_number, friendly_name: .friendly_name}' | head -5
  echo ""
  echo "To buy a specific number, run:"
  echo "  $0 $COUNTRY <phone_number> <webhook_url>"
  exit 0
fi

PHONE_NUMBER="${2}"
WEBHOOK_URL="${3}"

if [ -z "$PHONE_NUMBER" ] || [ -z "$WEBHOOK_URL" ]; then
  echo "Usage: $0 [country] <phone_number> <webhook_url>"
  echo "Example: $0 IN +91XXXXXXXXXX https://api.example.com/twilio/webhook"
  exit 1
fi

echo "Buying phone number: $PHONE_NUMBER"
echo "Setting webhook URL: $WEBHOOK_URL"

# Buy the number and set webhook in one call
RESPONSE=$(curl -X POST "https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers.json" \
  -u "${ACCOUNT_SID}:${AUTH}" \
  --data-urlencode "PhoneNumber=${PHONE_NUMBER}" \
  --data-urlencode "VoiceUrl=${WEBHOOK_URL}" \
  --data-urlencode "VoiceMethod=POST" \
  --data-urlencode "SmsUrl=${WEBHOOK_URL}/sms" \
  --data-urlencode "SmsMethod=POST")

PHONE_SID=$(echo "$RESPONSE" | jq -r '.sid')

if [ "$PHONE_SID" != "null" ] && [ -n "$PHONE_SID" ]; then
  echo "✅ Phone number purchased successfully!"
  echo "Phone SID: $PHONE_SID"
  echo "Phone Number: $PHONE_NUMBER"
  echo ""
  echo "Save the Phone SID for webhook updates:"
  echo "  export TWILIO_PHONE_SID=$PHONE_SID"
else
  echo "❌ Failed to purchase phone number"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

