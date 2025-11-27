# Twilio Migration Summary

## Overview

This document summarizes the migration from Amazon Connect to Twilio Voice.

## Reason for Migration

Amazon Connect cannot be used because our AWS account is provisioned by AISPL (Amazon Internet Services Private Limited). AISPL accounts are not permitted to create Amazon Connect instances due to region/reseller/telephony regulatory restrictions.

## Migration Changes

### Architecture Changes

- **Telephony Provider**: Amazon Connect → Twilio Voice
- **Integration Model**: AWS-native service → Webhook-based API
- **Phone Number Management**: AWS Console → Twilio Console/API
- **Call Flow**: Connect Contact Flows → TwiML (Twilio Markup Language)

### Code Changes

1. **Lambda Handler**
   - Old: `services/lambda/connect-handler.js` (deprecated)
   - New: `infra/lambda/twilio-webhook/handler.js`

2. **Database Schema**
   - Field renamed: `connect_contact_id` → `twilio_call_sid`
   - Migration: `002_add_connect_fields.sql` updated to handle rename

3. **Backend Routes**
   - Updated to use `twilio_call_sid` instead of `connect_contact_id`

4. **Scripts**
   - New: `scripts/twilio/buy_number.sh` - Purchase Twilio phone numbers
   - New: `scripts/twilio/provision_webhook.sh` - Configure webhook URLs

### Infrastructure Changes

1. **Terraform**
   - Removed: `infra/terraform/connect.tf` (Connect resources)
   - Added: `infra/terraform/twilio-provider.tf` (documentation and outputs)
   - Note: Twilio resources are managed via API, not Terraform

2. **CI/CD**
   - Added: `.github/workflows/deploy-twilio-lambda.yml`
   - Deploys Lambda and provisions webhook URL

### Documentation Updates

- `docs/architecture.md` - Added Twilio telephony section
- `docs/integration.md` - New Twilio integration guide
- `docs/twilio-costs.md` - Twilio cost analysis
- `docs/WEEK2_TASKS_SUMMARY.md` - Updated all Connect references
- `README.md` - Added Twilio setup instructions
- `docs/COST_MANAGEMENT_GUIDE.md` - Updated cost references

### Testing

- Added: `tests/integration/twilio-webhook.test.js` - Integration tests
- Added: `tests/unit/twilio-payload.test.js` - Unit tests for payload parsing

## Migration Steps

1. ✅ Update architecture documentation
2. ✅ Create Twilio Lambda handler
3. ✅ Create Twilio provisioning scripts
4. ✅ Update database migrations
5. ✅ Update backend routes
6. ✅ Update CI/CD pipelines
7. ✅ Add tests
8. ✅ Update all documentation

## Next Steps

1. Deploy Lambda function
2. Purchase Twilio phone number
3. Configure webhook URL
4. Test inbound/outbound calls
5. Verify recordings are saved to S3
6. Update production environment variables

## Rollback Plan

If needed, the old Connect handler can be restored from git history. However, Connect cannot be used due to AISPL restrictions, so rollback would require switching to a different AWS account type.

## References

- [Twilio Voice Documentation](https://www.twilio.com/docs/voice)
- [Twilio Webhooks](https://www.twilio.com/docs/voice/webhooks)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)

