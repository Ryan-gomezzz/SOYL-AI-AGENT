# SES Domain and Email Identity Configuration

# SES Domain Identity
resource "aws_ses_domain_identity" "main" {
  domain = var.domain
}

# SES Domain Identity Verification
resource "aws_ses_domain_identity_verification" "main" {
  domain = aws_ses_domain_identity.main.id

  timeouts {
    create = "5m"
  }
}

# SES Email Identity for Admin
resource "aws_ses_email_identity" "admin" {
  email = var.admin_email
}

# SES Configuration Set (optional - for tracking)
resource "aws_ses_configuration_set" "main" {
  name = "${local.project_prefix}-ses-config"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-ses-config"
    }
  )
}

# Note: SES Domain verification requires DNS TXT record
# The DNS record details will be output by Terraform
# Operator must manually add the TXT record to domain DNS settings

