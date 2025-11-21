# Pull Request: infra: Week1 setup — TF dry-run & repo skeleton

## Overview
This PR sets up the complete infrastructure skeleton and repository structure for Week 1 deliverables of the SOYL AI Agent project.

## Changes

### Infrastructure (Terraform)
- ✅ VPC with 2 public and 2 private subnets across 2 AZs
- ✅ Internet Gateway and NAT Gateways
- ✅ Security Groups (bastion, ECS, DB, EC2, ALB)
- ✅ RDS PostgreSQL instance (db.t3.medium) with Secrets Manager integration
- ✅ 3 S3 buckets (recordings, transcripts, static) with SSE-KMS encryption
- ✅ ECS Fargate cluster and service skeleton
- ✅ ECR repositories for backend and worker services
- ✅ EC2 GPU instance configuration for Ollama
- ✅ Lambda function and API Gateway (HTTP API)
- ✅ SES domain and email identity configuration
- ✅ IAM roles and policies (least-privilege)

### Service Skeletons
- ✅ Backend service (Node.js/Express) with Dockerfile
- ✅ Worker service (background job processor)
- ✅ Lambda function (enquiry handler)
- ✅ Frontend (React + Tailwind CSS)

### Documentation
- ✅ Architecture documentation with data model and call flow diagrams
- ✅ Deployment steps guide
- ✅ README files

### Scripts
- ✅ Local development script (Docker Compose)
- ✅ Terraform dry-run script

## Checklist

- [ ] Review terraform plan in `infra/terraform/plans/week1_plan.txt`
- [ ] Add SES DNS TXT record to domain and wait for verification
- [ ] Review EC2 userdata for secrets safety (`infra/terraform/olama_userdata.sh`)
- [ ] Verify SSH key name in `infra/terraform/terraform.tfvars` (not committed, use example)
- [ ] Review security group rules (especially bastion - currently allows 0.0.0.0/0)
- [ ] After manual approval, run `terraform apply` (Cursor will wait for explicit human confirmation)

## Manual Steps Required

1. **Install Terraform** (if not already installed)
   ```bash
   # Download from https://www.terraform.io/downloads
   ```

2. **Configure AWS Credentials**
   ```bash
   aws configure
   # Or set AWS_PROFILE environment variable
   ```

3. **Create terraform.tfvars** (copy from example)
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

4. **Run Terraform Plan**
   ```bash
   terraform init
   terraform validate
   terraform plan -out=tfplan
   terraform show tfplan > plans/week1_plan.txt
   terraform show -json tfplan > plans/week1_plan.json
   ```

5. **Add SES DNS Record**
   - Get verification token from Terraform output
   - Add TXT record: `_amazonses.www.soyl.cloud` with token value
   - Wait for verification (up to 24 hours, usually minutes)

6. **Review and Apply** (after SES verification)
   ```bash
   # Review plan carefully
   cat plans/week1_plan.txt
   
   # Apply (requires explicit approval)
   terraform apply tfplan
   ```

## Security Notes

⚠️ **IMPORTANT**: 
- Bastion security group currently allows SSH from 0.0.0.0/0 - **MUST be locked down** before production
- RDS credentials stored in Secrets Manager (not in Terraform variables)
- All S3 buckets have public access blocked
- IAM policies follow least-privilege principle (review and tighten as needed)

## Expected Resources

- 1 VPC with 4 subnets
- 1 RDS PostgreSQL instance
- 3 S3 buckets
- 1 ECS cluster + 1 service
- 2 ECR repositories
- 1 EC2 GPU instance
- 1 Lambda function
- 1 API Gateway
- Multiple IAM roles and policies
- 1 Secrets Manager secret

## Estimated Costs

~$200-500/month for staging environment (depending on EC2 instance type and usage)

## Next Steps After Merge

1. Run Terraform plan and review
2. Add SES DNS records
3. Apply Terraform infrastructure
4. Build and push backend Docker image to ECR
5. Create database schema
6. Configure Ollama on EC2
7. Set up CI/CD pipeline

## Files Changed

- 40 files created
- Complete infrastructure as code
- Service skeletons
- Documentation
- Scripts

## Testing

- [ ] Terraform validation passes
- [ ] Terraform plan generates successfully
- [ ] All files are properly formatted
- [ ] Documentation is complete and accurate

---

**Note**: This PR does NOT apply infrastructure changes. It only creates the Terraform configuration and repository structure. Infrastructure will be applied manually after review and approval.

