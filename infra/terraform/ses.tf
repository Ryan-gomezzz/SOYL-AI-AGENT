# SES Domain and Email Identity Configuration

# SES Domain Identity
resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

# SES Domain Identity Verification
# Note: This is commented out as it requires manual DNS TXT record setup first
# After adding the DNS record (output from terraform), uncomment and apply again
# resource "aws_ses_domain_identity_verification" "main" {
#   domain = aws_ses_domain_identity.main.id
#
#   timeouts {
#     create = "30m"
#   }
# }

# SES Email Identity for Admin
resource "aws_ses_email_identity" "admin" {
  email = var.admin_email
}

# SES Configuration Set (optional - for tracking)
# Note: Tags are not supported for aws_ses_configuration_set
resource "aws_ses_configuration_set" "main" {
  name = "${local.project_prefix}-ses-config"
}

# Note: SES Domain verification requires DNS TXT record
# The DNS record details will be output by Terraform
# Operator must manually add the TXT record to domain DNS settings

