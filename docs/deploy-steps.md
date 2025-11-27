# Deployment Steps - Infrastructure

This document provides step-by-step instructions for deploying the SOYL AI Agent infrastructure, including Lambda functions.

## Prerequisites

1. **AWS CLI** installed and configured
   ```bash
   aws configure
   # Or use: aws configure --profile <profile-name>
   ```

2. **Terraform** >= 1.0 installed
   ```bash
   terraform version
   ```

3. **Git** repository access
   ```bash
   git --version
   ```

4. **Domain DNS Access**: You need access to DNS settings for the domain specified in `DOMAIN` variable

## Step 1: Configure Terraform Variables

1. Copy the example variables file:
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your values:
   ```hcl
   aws_region        = "us-east-1"
   project           = "ai-ca-agent"
   environment       = "staging"
   ssh_key_name      = "your-ec2-keypair-name"
   admin_email       = "ryangomez9965@gmail.com"
   domain            = "www.soyl.cloud"
   ec2_instance_type = "g5.2xlarge"
   db_instance_class = "db.t3.medium"
   db_name           = "ai_ca_agent_db"
   db_username       = "aiadmin"
   db_allocated_storage = 20
   ```

## Step 2: Review Terraform Plan

1. Initialize Terraform:
   ```bash
   cd infra/terraform
   terraform init
   ```

2. Validate configuration:
   ```bash
   terraform validate
   ```

3. Generate and review plan:
   ```bash
   terraform plan -out=tfplan
   terraform show -json tfplan > plans/week1_plan.json
   terraform show tfplan > plans/week1_plan.txt
   ```

4. **Review the plan carefully** in `plans/week1_plan.txt`:
   - Check all resources being created
   - Verify resource names and tags
   - Confirm instance types and sizes
   - Review security group rules

## Step 3: Add SES DNS Records

**IMPORTANT**: This must be done BEFORE applying Terraform, or SES verification will fail.

1. Get the SES domain verification token from Terraform outputs:
   ```bash
   terraform output ses_domain_dns_records
   ```

   Or check the plan output for:
   ```
   aws_ses_domain_identity.main.verification_token
   ```

2. Add DNS TXT record to your domain:
   - **Record Name**: `_amazonses.www.soyl.cloud` (or `_amazonses.soyl.cloud` if using root domain)
   - **Record Type**: `TXT`
   - **Record Value**: The verification token from Terraform output

3. Wait for SES verification (can take up to 24 hours, usually completes within a few minutes):
   ```bash
   aws ses get-identity-verification-attributes --identities www.soyl.cloud
   ```

4. Verify admin email (if SES is in sandbox mode):
   - Check email inbox for verification email
   - Click verification link

## Step 4: Build Lambda Function Packages

Before applying Terraform, you need to build the Lambda function packages:

1. **Build Enquiry Handler Lambda**:
   ```bash
   cd services/lambda
   npm install --production
   # On Windows PowerShell:
   Compress-Archive -Path handler.js,package.json,node_modules -DestinationPath enquiry-handler.zip -Force
   # On Linux/Mac:
   zip -r enquiry-handler.zip handler.js package.json node_modules/
   ```

2. **Build Connect Handler Lambda** (deprecated but required by Terraform):
   ```bash
   cd services/lambda
   # On Windows PowerShell:
   Compress-Archive -Path connect-handler.js,package.json,node_modules -DestinationPath connect-handler.zip -Force
   # On Linux/Mac:
   zip -r connect-handler.zip connect-handler.js package.json node_modules/
   ```

3. **Build Transcribe Worker Lambda**:
   ```bash
   cd services/worker
   npm install --production
   # On Windows PowerShell:
   powershell -ExecutionPolicy Bypass -File ../../scripts/build-transcribe-lambda.ps1
   # On Linux/Mac:
   bash ../../scripts/build-transcribe-lambda.sh
   ```

## Step 5: Apply Terraform Infrastructure

**WARNING**: This will create AWS resources and incur costs. Review the plan carefully first.

1. **Manual Approval Required**: 
   - Review `infra/terraform/plans/week1_plan.txt`
   - Confirm all resources are correct
   - Verify costs are acceptable
   - Ensure Lambda zip files exist in `services/lambda/` and `services/worker/`

2. Apply Terraform:
   ```bash
   cd infra/terraform
   terraform apply tfplan
   ```

   Or if you prefer interactive confirmation:
   ```bash
   terraform apply
   ```

3. Wait for infrastructure creation (typically 10-15 minutes):
   - VPC and networking: ~2 minutes
   - RDS instance: ~5-10 minutes
   - EC2 instance: ~2-3 minutes
   - Lambda functions: ~1-2 minutes each
   - Other resources: ~1-2 minutes

4. Save outputs:
   ```bash
   terraform output -json > plans/week1_outputs.json
   ```

5. **Verify Lambda Functions**:
   ```bash
   # List deployed Lambda functions
   aws lambda list-functions --query "Functions[?contains(FunctionName, 'ai-ca-agent-staging')].FunctionName" --output table
   
   # Test enquiry handler
   API_URL=$(terraform output -raw api_gateway_url)
   curl -X POST $API_URL/enquiry \
     -H "Content-Type: application/json" \
     -d '{"name": "Test User", "email": "test@example.com", "message": "Test enquiry"}'
   ```

## Step 6: Build and Push Backend Docker Image

1. Get ECR login:
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <ecr-repo-url>
   ```

   Or use the output from Terraform:
   ```bash
   ECR_URL=$(terraform output -raw ecr_repo_urls | jq -r '.backend')
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin $ECR_URL
   ```

2. Build Docker image:
   ```bash
   cd services/backend
   docker build -t <ecr-repo-url>:latest .
   ```

3. Tag and push:
   ```bash
   docker tag <ecr-repo-url>:latest <ecr-repo-url>:latest
   docker push <ecr-repo-url>:latest
   ```

## Step 7: Update ECS Task Definition

1. Update the ECS task definition with the actual image URI:
   ```bash
   # Get the image URI from ECR
   IMAGE_URI=$(aws ecr describe-images --repository-name <repo-name> --image-ids imageTag=latest --query 'imageDetails[0].imageTags[0]' --output text)
   ```

2. Update ECS service (if needed):
   ```bash
   aws ecs update-service \
     --cluster <cluster-name> \
     --service <service-name> \
     --force-new-deployment
   ```

## Step 8: Configure EC2 Ollama Instance

1. SSH into the EC2 instance:
   ```bash
   ssh -i ~/.ssh/<key-name>.pem ubuntu@<ec2-public-ip>
   ```

2. Verify Docker and Ollama setup:
   ```bash
   docker ps
   docker images
   ```

3. Download model weights (if stored in S3):
   ```bash
   aws s3 sync s3://<project>-<environment>-static/models/ollama/ /opt/ollama/models/
   ```

4. Start Ollama service:
   ```bash
   sudo systemctl start ollama
   sudo systemctl status ollama
   ```

## Step 9: Database Setup

1. Connect to RDS database:
   ```bash
   # Get database credentials from Secrets Manager
   aws secretsmanager get-secret-value --secret-id <secret-arn> --query SecretString --output text | jq .
   ```

2. Connect using psql:
   ```bash
   psql -h <rds-endpoint> -U <db-username> -d <db-name>
   ```

3. Create initial tables (see `docs/architecture.md` for schema):
   ```sql
   -- Run the SQL schema from architecture.md
   ```

## Step 10: Smoke Tests

1. **Test API Gateway endpoint**:
   ```bash
   API_URL=$(terraform output -raw api_gateway_url)
   curl -X POST $API_URL/enquiry \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "message": "Test enquiry"
     }'
   ```

2. **Test ECS service health**:
   ```bash
   # Get ECS service endpoint (if ALB is configured)
   curl http://<alb-dns-name>/health
   ```

3. **Test Ollama API** (from ECS or EC2):
   ```bash
   curl http://<ec2-private-ip>:11434/api/tags
   ```

4. **Verify S3 buckets**:
   ```bash
   aws s3 ls s3://<project>-<environment>-recordings-<region>/
   aws s3 ls s3://<project>-<environment>-transcripts-<region>/
   aws s3 ls s3://<project>-<environment>-static-<region>/
   ```

## Step 11: Post-Deployment Tasks

1. **Lock down Bastion Security Group**:
   - Update security group to allow SSH only from your IP
   - Remove 0.0.0.0/0 access

2. **Rotate Database Password** (if needed):
   ```bash
   aws secretsmanager rotate-secret --secret-id <secret-arn>
   ```

3. **Set up CloudWatch Alarms**:
   - RDS CPU/Memory usage
   - ECS service health
   - Lambda error rate
   - EC2 instance status

4. **Configure Backup Retention**:
   - Verify RDS backup retention is set correctly
   - Set up S3 lifecycle policies if needed

## Troubleshooting

### SES Verification Fails
- Check DNS TXT record is correctly added
- Wait up to 24 hours for propagation
- Verify domain ownership in AWS SES console

### EC2 Instance Not Accessible
- Check security group allows SSH from your IP
- Verify key pair name is correct
- Check instance status in EC2 console

### RDS Connection Issues
- Verify security group allows connections from ECS/private subnets
- Check RDS endpoint is correct
- Verify credentials in Secrets Manager

### ECS Service Not Starting
- Check CloudWatch logs for errors
- Verify ECR image exists and is accessible
- Check task definition resource limits
- Verify IAM roles have correct permissions

### Lambda Function Errors
- Check CloudWatch logs for the function:
  ```bash
  aws logs tail /aws/lambda/<function-name> --follow
  ```
- Verify Secrets Manager permissions
- Check environment variables are set correctly (note: `AWS_REGION` is reserved and cannot be set)
- Verify Lambda zip files are built correctly and contain all dependencies
- Check VPC configuration if Lambda needs database access
- Verify IAM role has necessary permissions (VPC access, Secrets Manager, S3, etc.)

## Cost Optimization

1. **Stop EC2 instance** when not in use (for development):
   ```bash
   aws ec2 stop-instances --instance-ids <instance-id>
   ```

2. **Scale down ECS service** to 0 tasks when not needed:
   ```bash
   aws ecs update-service --cluster <cluster> --service <service> --desired-count 0
   ```

3. **Use smaller instance types** for development (e.g., `g4dn.xlarge` instead of `g5.2xlarge`)

4. **Enable RDS automated backups** only if needed (adds cost)

## Next Steps

After successful deployment:

1. Set up CI/CD pipeline
2. Configure monitoring and alerting
3. Implement application code
4. Set up staging/production environments
5. Configure domain and SSL certificates
6. Set up automated backups

## Rollback Procedure

If you need to destroy the infrastructure:

```bash
cd infra/terraform
terraform destroy
```

**WARNING**: This will delete ALL resources. Make sure you have backups of any important data.

