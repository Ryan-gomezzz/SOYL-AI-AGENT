# S3 Buckets Configuration

# KMS Key for S3 encryption
resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 10

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-s3-kms-key"
    }
  )
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.project_prefix}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# S3 Bucket for Recordings
resource "aws_s3_bucket" "recordings" {
  bucket = "${local.project_prefix}-recordings-${data.aws_region.current.name}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-recordings"
      Type = "recordings"
    }
  )
}

resource "aws_s3_bucket_versioning" "recordings" {
  bucket = aws_s3_bucket.recordings.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "recordings" {
  bucket = aws_s3_bucket.recordings.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets  = true
}

# S3 Bucket Policy for Connect to write recordings
# This allows Amazon Connect service to write call recordings to the bucket
resource "aws_s3_bucket_policy" "recordings_connect" {
  bucket = aws_s3_bucket.recordings.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowConnectServiceWrite"
        Effect = "Allow"
        Principal = {
          Service = "connect.amazonaws.com"
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.recordings.arn}/*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowConnectServiceList"
        Effect = "Allow"
        Principal = {
          Service = "connect.amazonaws.com"
        }
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.recordings.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket.recordings]
}

# S3 Bucket for Transcripts
resource "aws_s3_bucket" "transcripts" {
  bucket = "${local.project_prefix}-transcripts-${data.aws_region.current.name}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-transcripts"
      Type = "transcripts"
    }
  )
}

resource "aws_s3_bucket_versioning" "transcripts" {
  bucket = aws_s3_bucket.transcripts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "transcripts" {
  bucket = aws_s3_bucket.transcripts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "transcripts" {
  bucket = aws_s3_bucket.transcripts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets  = true
}

# S3 Bucket for Static Assets
resource "aws_s3_bucket" "static" {
  bucket = "${local.project_prefix}-static-${data.aws_region.current.name}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-static"
      Type = "static-assets"
    }
  )
}

resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets  = true
}

