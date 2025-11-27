# Twilio Provider Configuration (Example)
# 
# Note: Twilio does not have an official Terraform provider.
# Phone numbers and webhooks are managed via Twilio REST API.
# 
# This file documents the approach and provides outputs for webhook URLs.
#
# To provision Twilio resources, use:
# - Twilio CLI: https://www.twilio.com/docs/twilio-cli/quickstart
# - REST API: scripts/twilio/buy_number.sh and scripts/twilio/provision_webhook.sh
# - CI/CD: GitHub Actions workflow will call these scripts during deployment

# Example: Store Twilio credentials in AWS Secrets Manager
# (Twilio credentials should NOT be in Terraform state)
resource "aws_secretsmanager_secret" "twilio_credentials" {
  name = "${local.project_prefix}-twilio-credentials"
  description = "Twilio Account SID and Auth Token"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-twilio-secret"
    }
  )
}

# Note: Secret values should be set manually or via CI/CD:
# aws secretsmanager put-secret-value \
#   --secret-id ${local.project_prefix}-twilio-credentials \
#   --secret-string '{"account_sid":"AC...","auth_token":"..."}'

# Outputs for Twilio webhook URL
output "twilio_webhook_url" {
  description = "Twilio webhook URL for phone numbers"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/twilio/webhook"
}

output "twilio_webhook_sms_url" {
  description = "Twilio SMS webhook URL"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/twilio/webhook/sms"
}

# Instructions for provisioning Twilio phone number:
# 1. Set environment variables:
#    export TWILIO_ACCOUNT_SID="AC..."
#    export TWILIO_AUTH_TOKEN="..."
# 2. Run: scripts/twilio/buy_number.sh IN <phone_number> <webhook_url>
# 3. Save the returned Phone SID for future updates
# 4. Update webhook: scripts/twilio/provision_webhook.sh <phone_sid> <webhook_url>

