# Terraform Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "rds_endpoint" {
  description = "RDS endpoint address"
  value       = aws_db_instance.main.address
  sensitive   = true
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "s3_bucket_names" {
  description = "S3 bucket names"
  value = {
    recordings  = aws_s3_bucket.recordings.id
    transcripts = aws_s3_bucket.transcripts.id
    static      = aws_s3_bucket.static.id
  }
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "ecr_repo_urls" {
  description = "ECR repository URLs"
  value = {
    backend = aws_ecr_repository.backend.repository_url
    worker  = aws_ecr_repository.worker.repository_url
  }
}

output "ec2_ollama_instance_id" {
  description = "EC2 Ollama instance ID"
  value       = aws_instance.ollama.id
}

output "ec2_ollama_public_ip" {
  description = "EC2 Ollama instance public IP"
  value       = aws_instance.ollama.public_ip
}

output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.enquiry_handler.function_name
}

output "ses_domain_identity_verification_token" {
  description = "SES domain verification token (add as TXT record to DNS)"
  value       = aws_ses_domain_identity.main.verification_token
}

output "ses_domain_dns_records" {
  description = "SES domain DNS records to add"
  value = {
    name  = "_amazonses.${var.domain}"
    type  = "TXT"
    value = aws_ses_domain_identity.main.verification_token
  }
}

output "ses_email_identity_arn" {
  description = "SES email identity ARN"
  value       = aws_ses_email_identity.admin.arn
}

output "security_group_ids" {
  description = "Security group IDs"
  value = {
    bastion = aws_security_group.bastion.id
    ecs     = aws_security_group.ecs.id
    db      = aws_security_group.db.id
    ec2     = aws_security_group.ec2.id
    alb     = aws_security_group.alb.id
  }
}

