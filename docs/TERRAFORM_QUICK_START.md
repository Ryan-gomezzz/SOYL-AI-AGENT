# Terraform Quick Start Guide

## Prerequisites Check

### 1. Install Terraform (if not installed)

**Windows (PowerShell):**
```powershell
# Using Chocolatey (if installed)
choco install terraform

# Or download manually:
# 1. Visit: https://www.terraform.io/downloads
# 2. Download Windows 64-bit zip
# 3. Extract to a folder (e.g., C:\terraform)
# 4. Add to PATH environment variable
```

**Verify installation:**
```bash
terraform version
# Should show: Terraform v1.x.x
```

### 2. Verify AWS CLI Configuration

```bash
aws configure list
# Should show your credentials

aws sts get-caller-identity
# Should show your IAM user (currently: aisalesagent-deploy)
```

**Current AWS Configuration:**
- **IAM User**: `aisalesagent-deploy`
- **Account**: `381492072674`
- **Region**: `ap-south-1` (but Terraform will use `us-east-1` from tfvars)

## Step-by-Step: Running Terraform

### Step 1: Navigate to Terraform Directory

```bash
cd infra/terraform
```

### Step 2: Verify Variables File

Check that `terraform.tfvars` exists and has correct values:

```bash
# View current values
cat terraform.tfvars
```

**Important variables to verify:**
- `aws_region`: Should match your preferred region
- `ssh_key_name`: Must be a valid EC2 keypair in your AWS account
- `admin_email`: Your email for SES verification
- `domain`: Domain for SES verification

### Step 3: Initialize Terraform

This downloads the AWS provider and sets up Terraform:

```bash
terraform init
```

**Expected output:**
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Finding hashicorp/random versions matching "~> 3.1"...
- Installing hashicorp/aws v5.x.x...
- Installing hashicorp/random v3.x.x...
Terraform has been successfully initialized!
```

### Step 4: Validate Configuration

Check for syntax errors:

```bash
terraform validate
```

**Expected output:**
```
Success! The configuration is valid.
```

If there are errors, fix them before proceeding.

### Step 5: Generate Plan (Dry-Run)

**Option A: Using the script (recommended)**
```bash
# From project root
cd scripts
bash terraform-dry-run.sh
# Or on Windows with Git Bash
./terraform-dry-run.sh
```

**Option B: Manual commands**
```bash
cd infra/terraform

# Generate plan
terraform plan -out=tfplan

# Save human-readable plan
terraform show tfplan > plans/week1_plan.txt

# Save JSON plan
terraform show -json tfplan > plans/week1_plan.json
```

**Review the plan:**
```bash
cat plans/week1_plan.txt
# Or open in your editor
```

**What to check in the plan:**
- ✅ Number of resources to be created (should be ~30-40)
- ✅ Resource names and tags
- ✅ Instance types (EC2: g5.2xlarge, RDS: db.t3.medium)
- ✅ Security group rules
- ✅ Estimated costs

### Step 6: Add SES DNS Record (BEFORE APPLY)

**IMPORTANT**: SES domain verification must be done before applying, or it will fail.

1. Get the SES verification token from the plan:
   ```bash
   terraform plan | grep verification_token
   # Or check the plan output
   ```

2. Add DNS TXT record to your domain:
   - **Record Name**: `_amazonses.www.soyl.cloud`
   - **Record Type**: `TXT`
   - **Record Value**: (verification token from plan)

3. Wait for verification (check status):
   ```bash
   aws ses get-identity-verification-attributes --identities www.soyl.cloud
   ```

### Step 7: Apply Infrastructure

**⚠️ WARNING**: This will create AWS resources and incur costs!

**Option A: Apply saved plan**
```bash
cd infra/terraform
terraform apply tfplan
```

**Option B: Interactive apply**
```bash
terraform apply
# Terraform will show the plan and ask for confirmation
# Type: yes
```

**Expected output:**
```
Plan: 35 to add, 0 to change, 0 to destroy.

Do you want to perform these actions?
  Terraform will perform the actions described above.
  Only 'yes' will be accepted to approve.

  Enter a value: yes

aws_vpc.main: Creating...
aws_vpc.main: Creation complete after 2s
...
Apply complete! Resources: 35 added, 0 changed, 0 destroyed.
```

**Time estimate**: 10-15 minutes (RDS takes ~5-10 minutes)

### Step 8: View Outputs

After successful apply:

```bash
terraform output
```

**Save outputs to file:**
```bash
terraform output -json > plans/week1_outputs.json
```

**Important outputs:**
- `rds_endpoint`: Database connection string
- `rds_secret_arn`: Secrets Manager ARN for DB credentials
- `s3_bucket_names`: S3 bucket names
- `ecs_cluster_name`: ECS cluster name
- `api_gateway_url`: API endpoint URL
- `ec2_ollama_instance_id`: EC2 instance ID
- `ses_domain_dns_records`: SES DNS records

## Common Commands Reference

```bash
# Initialize
terraform init

# Validate
terraform validate

# Plan (dry-run)
terraform plan

# Plan and save
terraform plan -out=tfplan

# Apply saved plan
terraform apply tfplan

# Apply interactively
terraform apply

# View outputs
terraform output

# View specific output
terraform output rds_endpoint

# Refresh state (check current state)
terraform refresh

# Show current state
terraform show

# Destroy all resources (⚠️ DANGEROUS)
terraform destroy

# Format code
terraform fmt

# Check formatting
terraform fmt -check
```

## Troubleshooting

### Error: "Terraform not found"
**Solution**: Install Terraform and add to PATH

### Error: "No valid credential sources found"
**Solution**: 
```bash
aws configure
# Enter your AWS Access Key ID and Secret Access Key
```

### Error: "InvalidKeyPair.NotFound"
**Solution**: 
- Check `ssh_key_name` in `terraform.tfvars`
- Verify keypair exists in the correct region:
  ```bash
  aws ec2 describe-key-pairs --region us-east-1
  ```

### Error: "SES domain verification failed"
**Solution**: 
- Add DNS TXT record before applying
- Wait for DNS propagation (can take up to 24 hours)

### Error: "Insufficient permissions"
**Solution**: 
- Verify `aisalesagent-deploy` user has required permissions
- May need to attach IAM policies for:
  - VPC, EC2, RDS, S3, ECS, ECR, Lambda, API Gateway, SES, IAM, Secrets Manager

### Error: "Resource already exists"
**Solution**: 
- Check if resources were partially created
- Import existing resources or destroy and recreate

## Cost Estimation

**Before applying**, estimate costs:

```bash
# Terraform doesn't have built-in cost estimation
# Use AWS Pricing Calculator or check plan output
```

**Approximate monthly costs (if running 24/7):**
- EC2 g5.2xlarge: ~$730/month
- RDS db.t3.medium: ~$73/month
- NAT Gateways (2x): ~$130/month
- ECS Fargate: ~$30-50/month
- S3: ~$5-10/month
- **Total**: ~$200-500/month

**To reduce costs:**
- Stop EC2 instance when not in use
- Use smaller instance types for testing
- Scale down ECS services

## Next Steps After Apply

1. **Get RDS credentials:**
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id $(terraform output -raw rds_secret_arn) \
     --query SecretString --output text
   ```

2. **Connect to EC2 instance:**
   ```bash
   ssh -i ~/.ssh/your-key.pem ubuntu@$(terraform output -raw ec2_ollama_public_ip)
   ```

3. **Build and push Docker images:**
   ```bash
   # Get ECR login
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin \
     $(terraform output -raw ecr_repo_urls | jq -r '.backend')
   
   # Build and push
   docker build -t backend services/backend
   docker tag backend:latest <ecr-url>:latest
   docker push <ecr-url>:latest
   ```

4. **Test API Gateway:**
   ```bash
   curl $(terraform output -raw api_gateway_url)/enquiry \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com","message":"Test"}'
   ```

## Safety Reminders

- ⚠️ **Always review the plan** before applying
- ⚠️ **Verify costs** before applying
- ⚠️ **Backup important data** before destroy
- ⚠️ **Lock down security groups** after deployment
- ⚠️ **Rotate credentials** after initial setup

## Getting Help

- **Terraform Docs**: https://www.terraform.io/docs
- **AWS Provider Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **Project Docs**: See `docs/deploy-steps.md` for detailed deployment guide

---

**Quick Command Summary:**
```bash
cd infra/terraform
terraform init
terraform validate
terraform plan -out=tfplan
# Review plan/week1_plan.txt
terraform apply tfplan
terraform output
```

