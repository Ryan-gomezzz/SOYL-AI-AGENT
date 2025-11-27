# PR: Replace Amazon Connect with Twilio Voice

## Summary

This PR replaces Amazon Connect with Twilio Voice due to AISPL account restrictions that prevent creation of Amazon Connect instances.

## Reason

Our AWS account is provisioned by AISPL (Amazon Internet Services Private Limited). AISPL accounts are not permitted to create Amazon Connect instances due to region/reseller/telephony regulatory restrictions. To avoid delaying development, we are switching to Twilio Voice, which provides:
- Instant phone number provisioning
- Webhook-driven model that fits our API Gateway + Lambda architecture
- Support for both inbound & outbound calls
- Real-time audio streaming support
- Clean integration with our AI agent

## Changes

### New Files Created

1. **Lambda Handler**
   - `infra/lambda/twilio-webhook/handler.js` - Twilio webhook handler
   - `infra/lambda/twilio-webhook/package.json` - Dependencies

2. **Scripts**
   - `scripts/twilio/buy_number.sh` - Purchase Twilio phone numbers
   - `scripts/twilio/provision_webhook.sh` - Configure webhook URLs

3. **Terraform**
   - `infra/terraform/twilio-provider.tf` - Documentation and outputs

4. **Documentation**
   - `docs/integration.md` - Twilio integration guide
   - `docs/twilio-costs.md` - Twilio cost analysis
   - `docs/TWILIO_MIGRATION_SUMMARY.md` - Migration summary

5. **Tests**
   - `tests/integration/twilio-webhook.test.js` - Integration tests
   - `tests/unit/twilio-payload.test.js` - Unit tests

6. **CI/CD**
   - `.github/workflows/deploy-twilio-lambda.yml` - Deployment workflow

### Files Modified

1. **Architecture & Documentation**
   - `docs/architecture.md` - Added Twilio telephony section
   - `README.md` - Added Twilio setup instructions
   - `docs/WEEK2_TASKS_SUMMARY.md` - Replaced all Connect references
   - `docs/COST_MANAGEMENT_GUIDE.md` - Updated cost references
   - `reference/README.md` - Updated data model

2. **Database**
   - `services/backend/migrations/002_create_calls_table.sql` - Renamed `connect_contact_id` to `twilio_call_sid`
   - `services/backend/src/utils/migrations/002_add_connect_fields.sql` - Updated to handle field rename

3. **Backend Routes**
   - `services/backend/src/routes/calls.js` - Updated to use `twilio_call_sid`
   - `services/backend/src/routes/transcripts.js` - Updated to use `twilio_call_sid`

4. **Deprecated Files**
   - `services/lambda/connect-handler.js` - Marked as deprecated

## Testing

- ✅ Integration tests for webhook signature validation
- ✅ Unit tests for payload parsing
- ✅ Error handling tests

## Deployment Steps

1. Add secrets to CI/CD:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_SID` (optional, for auto-provisioning)
   - `WEBHOOK_FULL_URL`
   - `VAPI_ENDPOINT` (optional)
   - `VAPI_API_KEY` (optional)

2. Deploy Lambda function (via CI/CD or manually)

3. Purchase Twilio phone number:
   ```bash
   ./scripts/twilio/buy_number.sh IN +91XXXXXXXXXX <webhook_url>
   ```

4. Configure webhook (if not done automatically):
   ```bash
   ./scripts/twilio/provision_webhook.sh <phone_sid> <webhook_url>
   ```

## Breaking Changes

- Database field renamed: `connect_contact_id` → `twilio_call_sid`
- Migration will automatically rename existing columns if present

## Notes

- Amazon Connect Terraform files (`infra/terraform/connect.tf`) are kept for reference but should not be applied
- Old Connect handler is deprecated but kept for reference
- All documentation includes notes about the AISPL restriction

## References

- [Twilio Voice Docs](https://www.twilio.com/docs/voice)
- [Twilio Webhooks](https://www.twilio.com/docs/voice/webhooks)
- Migration summary: `docs/TWILIO_MIGRATION_SUMMARY.md`
