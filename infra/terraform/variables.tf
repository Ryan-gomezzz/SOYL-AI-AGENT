variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "ai-ca-agent"
}

variable "environment" {
  description = "Environment name (staging, production, etc.)"
  type        = string
  default     = "staging"
}

variable "ssh_key_name" {
  description = "EC2 keypair name for SSH access"
  type        = string
}

variable "admin_email" {
  description = "Admin email for SES verification"
  type        = string
}

variable "domain" {
  description = "Domain name for SES verification"
  type        = string
}

variable "ec2_instance_type" {
  description = "EC2 instance type for GPU/Ollama"
  type        = string
  default     = "g5.2xlarge"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "ai_ca_agent_db"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "aiadmin"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "s3_bucket_suffix" {
  description = "Suffix for S3 bucket names"
  type        = string
  default     = ""
}

