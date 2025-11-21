# Main Terraform configuration for SOYL AI Agent infrastructure
# This file serves as the entry point and organizes all resources

locals {
  project_prefix = "${var.project}-${var.environment}"
  
  common_tags = {
    Name    = local.project_prefix
    Project = var.project
    Env     = var.environment
  }

  s3_bucket_suffix = var.s3_bucket_suffix != "" ? var.s3_bucket_suffix : "${var.project}-${var.environment}-assets"
  
  # Get availability zones
  availability_zones = data.aws_availability_zones.available.names
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

