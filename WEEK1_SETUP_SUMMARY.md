# Week 1 Infrastructure Setup - Summary

## ✅ Completed Tasks

### Repository Structure
- ✅ Created complete repository skeleton
- ✅ Created branch `infra/week1-setup`
- ✅ Committed all files to git
- ✅ All required files created and organized

### Terraform Configuration
- ✅ VPC with public/private subnets across 2 AZs
- ✅ Internet Gateway and NAT Gateways
- ✅ Security Groups (bastion, ECS, DB, EC2, ALB)
- ✅ RDS PostgreSQL configuration
- ✅ 3 S3 buckets (recordings, transcripts, static) with encryption
- ✅ ECS Cluster and Fargate service skeleton
- ✅ ECR repositories for backend and worker
- ✅ EC2 GPU instance configuration for Ollama
- ✅ Lambda function and API Gateway
- ✅ SES domain and email identity
- ✅ IAM roles and policies (least-privilege)
- ✅ Secrets Manager integration for RDS credentials

### Service Skeletons
- ✅ Backend service (Node.js/Express)
- ✅ Worker service (background jobs)
- ✅ Lambda function (enquiry handler)
- ✅ Frontend (React + Tailwind)

### Documentation
- ✅ Architecture documentation with data model and call flow
- ✅ Deployment steps guide
- ✅ README files

### Scripts
- ✅ Local development script (Docker Compose)
- ✅ Terraform dry-run script

## ⚠️ Manual Steps Required

### 1. Install Terraform
Terraform is not currently installed. Install it from: https://www.terraform.io/downloads

### 2. Configure AWS Credentials
```bash
aws configure
# Or set AWS_PROFILE environment variable
```

### 3. Update SSH Key Name
Edit `infra/terraform/terraform.tfvars` and update `ssh_key_name` with your actual EC2 keypair name.

### 4. Run Terraform Plan
```bash
cd infra/terraform
terraform init
terraform validate
terraform plan -out=tfplan
terraform show tfplan > plans/week1_plan.txt
terraform show -json tfplan > plans/week1_plan.json
```

### 5. Add SES DNS Record
After running terraform plan, get the SES verification token:
```bash
terraform output ses_domain_dns_records
```

Add DNS TXT record:
- **Name**: `_amazonses.www.soyl.cloud`
- **Type**: `TXT`
- **Value**: (verification token from Terraform output)

Wait for SES verification (up to 24 hours, usually completes in minutes).

### 6. Review and Apply Terraform
```bash
# Review the plan carefully
cat plans/week1_plan.txt

# After review and SES verification, apply
terraform apply tfplan
```

### 7. Push to Remote Repository
```bash
git push -u origin infra/week1-setup
```

### 8. Create Pull Request
Create a PR from `infra/week1-setup` to `main` with title:
"infra: Week1 setup — TF dry-run & repo skeleton"

## 📋 PR Checklist

- [ ] Review terraform plan in `infra/terraform/plans/week1_plan.txt`
- [ ] Add SES DNS TXT to domain and wait for verification
- [ ] Review EC2 userdata for secrets safety
- [ ] Verify SSH key name in terraform.tfvars
- [ ] Review security group rules (especially bastion)
- [ ] After manual approval, run `terraform apply`

## 🔒 Security Notes

1. **Bastion Security Group**: Currently allows SSH from 0.0.0.0/0. **MUST be locked down** to specific IP ranges before production use.

2. **RDS Credentials**: Stored in AWS Secrets Manager. Never commit terraform.tfvars with sensitive data.

3. **S3 Buckets**: All buckets have public access blocked and use SSE-KMS encryption.

4. **IAM Policies**: Follow least-privilege principle. Review and tighten as needed.

## 📊 Expected Resources

- **VPC**: 1 VPC with 4 subnets (2 public, 2 private)
- **RDS**: 1 PostgreSQL instance (db.t3.medium)
- **S3**: 3 buckets
- **ECS**: 1 cluster, 1 service
- **ECR**: 2 repositories
- **EC2**: 1 GPU instance (g5.2xlarge)
- **Lambda**: 1 function
- **API Gateway**: 1 HTTP API
- **SES**: 1 domain identity, 1 email identity
- **IAM**: Multiple roles and policies
- **Secrets Manager**: 1 secret for RDS

## 💰 Estimated Costs

- **EC2 g5.2xlarge**: ~$1.00/hour (~$730/month if running 24/7)
- **RDS db.t3.medium**: ~$0.10/hour (~$73/month)
- **NAT Gateways**: ~$0.045/hour each (~$65/month for 2)
- **ECS Fargate**: ~$0.04/vCPU-hour + $0.004/GB-hour
- **S3**: Pay per use (minimal for staging)
- **Lambda**: Pay per request (minimal for staging)
- **Data Transfer**: Variable

**Total Estimated**: ~$200-500/month for staging environment (depending on usage)

## 🚀 Next Steps After Infrastructure is Deployed

1. Build and push backend Docker image to ECR
2. Update ECS task definition with actual image
3. Create database schema (see `docs/architecture.md`)
4. Configure Ollama on EC2 instance
5. Set up CI/CD pipeline
6. Configure monitoring and alerting
7. Lock down security groups
8. Set up automated backups

## 📝 TODO List for Week 1 Engineers

### Engineer A (Backend)
- [ ] Implement enquiry API endpoint
- [ ] Set up database connection with Secrets Manager
- [ ] Create database migration scripts
- [ ] Implement SQS integration for async processing
- [ ] Add unit tests

### Engineer B (Infrastructure)
- [ ] Review and optimize Terraform configuration
- [ ] Set up CloudWatch alarms
- [ ] Configure backup policies
- [ ] Set up CI/CD pipeline
- [ ] Document runbooks

### Engineer C (DevOps/Platform)
- [ ] Configure ECS service auto-scaling
- [ ] Set up monitoring dashboards
- [ ] Configure log aggregation
- [ ] Set up alerting rules
- [ ] Review and tighten IAM policies

## 📞 Support

For issues or questions:
- Review `docs/architecture.md` for architecture details
- Review `docs/deploy-steps.md` for deployment instructions
- Check Terraform plan output for resource details
- Review AWS console for resource status

## ⚡ Quick Commands Reference

```bash
# Initialize Terraform
cd infra/terraform
terraform init

# Validate configuration
terraform validate

# Generate plan
terraform plan -out=tfplan

# View plan
terraform show tfplan

# Apply (after review)
terraform apply tfplan

# View outputs
terraform output

# Destroy (if needed)
terraform destroy
```

---

**Status**: ✅ Repository structure complete, ready for Terraform plan and review
**Branch**: `infra/week1-setup`
**Next Action**: Install Terraform and run `terraform plan`

