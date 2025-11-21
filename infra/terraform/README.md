# Terraform Infrastructure

This directory contains Terraform configuration for the SOYL AI Agent infrastructure.

## Structure

- `main.tf`: Main configuration and module organization
- `providers.tf`: AWS provider configuration
- `variables.tf`: Input variables
- `vpc.tf`: VPC, subnets, gateways, and networking
- `rds.tf`: RDS PostgreSQL database
- `s3.tf`: S3 buckets for recordings, transcripts, and static assets
- `iam.tf`: IAM roles and policies
- `ecs.tf`: ECS cluster and service definitions
- `ecr.tf`: ECR repositories
- `ec2.tf`: EC2 GPU instance for Ollama
- `ses.tf`: SES domain and email identities
- `lambda.tf`: Lambda functions and API Gateway
- `outputs.tf`: Output values

## Usage

### Initialize Terraform
```bash
terraform init
```

### Validate Configuration
```bash
terraform validate
```

### Plan Changes
```bash
terraform plan -out=tfplan
```

### Apply Changes (after review)
```bash
terraform apply tfplan
```

### Destroy Infrastructure
```bash
terraform destroy
```

## Variables

See `variables.tf` for all available variables. Required variables should be set via:
- `terraform.tfvars` file (not committed to git)
- Environment variables (TF_VAR_*)
- Command line flags

## Outputs

After applying, view outputs with:
```bash
terraform output
```

## Plans

Terraform plan outputs are saved in the `plans/` directory:
- `week1_plan.txt`: Human-readable plan
- `week1_plan.json`: JSON format plan
- `week1_outputs.json`: Expected outputs

