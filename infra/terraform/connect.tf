# Amazon Connect Configuration
# Ref: reference/README.md -> WEEK 2 - Engineer A - Amazon Connect

# IAM Role for Amazon Connect Service
resource "aws_iam_role" "connect" {
  name = "${local.project_prefix}-connect-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "connect.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-connect-service-role"
    }
  )
}

# IAM Policy for Connect to access S3 recordings bucket
resource "aws_iam_role_policy" "connect_s3_recordings" {
  name = "${local.project_prefix}-connect-s3-recordings-policy"
  role = aws_iam_role.connect.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.recordings.arn,
          "${aws_s3_bucket.recordings.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.s3.arn
      }
    ]
  })
}

# IAM Policy for Connect to publish metrics to CloudWatch
resource "aws_iam_role_policy" "connect_cloudwatch" {
  name = "${local.project_prefix}-connect-cloudwatch-policy"
  role = aws_iam_role.connect.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "AWS/Connect"
          }
        }
      }
    ]
  })
}

# Amazon Connect Instance
# Note: Storage configuration must be done manually in AWS Console after instance creation
# See manual steps in WEEK2_TASKS_SUMMARY.md
# DISABLED: AISPL accounts cannot create Connect instances
# resource "aws_connect_instance" "main" {
#   identity_management_type = "CONNECT_MANAGED" # Use Connect's built-in identity management
#   inbound_calls_enabled    = true
#   outbound_calls_enabled   = true
#   instance_alias           = "${local.project_prefix}-connect"
#
#   tags = merge(
#     local.common_tags,
#     {
#       Name = "${local.project_prefix}-connect-instance"
#     }
#   )
#
#   depends_on = [
#     aws_s3_bucket.recordings,
#     aws_iam_role.connect
#   ]
# }

# Note: Storage configuration for recordings must be configured manually:
# 1. Go to AWS Connect Console
# 2. Select the instance
# 3. Go to "Data storage" settings
# 4. Configure S3 bucket: ${aws_s3_bucket.recordings.id}
# 5. Set prefix: "connect-recordings"
# 6. Enable call recordings storage

# Output the Connect instance details
# DISABLED: AISPL accounts cannot create Connect instances
# output "connect_instance_id" {
#   description = "Amazon Connect Instance ID"
#   value       = aws_connect_instance.main.id
# }
#
# output "connect_instance_arn" {
#   description = "Amazon Connect Instance ARN"
#   value       = aws_connect_instance.main.arn
# }
#
# output "connect_service_url" {
#   description = "Amazon Connect Service URL (for accessing Connect console)"
#   value       = "https://${aws_connect_instance.main.id}.my.connect.aws"
# }

