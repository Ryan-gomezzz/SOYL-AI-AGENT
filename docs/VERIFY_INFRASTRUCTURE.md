# How to Verify Week 1 Infrastructure Deployment

This guide shows you how to verify that all infrastructure listed in `docs/WEEK1_REMAINING_TASKS.md` (lines 8-15) is actually deployed to AWS.

## Quick Verification Script

Run the automated verification script:

**Windows PowerShell:**
```powershell
.\scripts\verify-infrastructure.ps1
```

This script checks all resources and provides a summary.

## Manual Verification Steps

### 1. Verify Using Terraform Outputs

The easiest way is to check Terraform outputs:

```powershell
cd infra/terraform
terraform output
```

You should see outputs for:
- VPC ID
- Subnet IDs
- RDS endpoint
- S3 bucket names
- ECS cluster name
- ECR repository URLs
- API Gateway URL
- Lambda function name
- EC2 instance ID

### 2. Verify Each Resource Type

#### A. VPC & Subnets

```powershell
# Check VPC
aws ec2 describe-vpcs --filters "Name=tag:Name,Values=ai-ca-agent-staging-vpc" --region us-east-1

# Check Subnets (should find 4: 2 public, 2 private)
aws ec2 describe-subnets --filters "Name=tag:Name,Values=ai-ca-agent-staging-*" --region us-east-1 --query 'Subnets[*].[SubnetId,Tags[?Key==`Name`].Value|[0]]'
```

**Expected:** 1 VPC, 4 subnets (2 public, 2 private)

#### B. RDS PostgreSQL

```powershell
aws rds describe-db-instances --db-instance-identifier ai-ca-agent-staging-db --region us-east-1 --query 'DBInstances[0].[DBInstanceIdentifier,DBInstanceStatus,Endpoint.Address]'
```

**Expected:** Database instance named `ai-ca-agent-staging-db` in `available` status

#### C. S3 Buckets

```powershell
# List all S3 buckets for the project
aws s3 ls | Select-String "ai-ca-agent-staging"

# Check each bucket individually
aws s3api head-bucket --bucket ai-ca-agent-staging-recordings-us-east-1
aws s3api head-bucket --bucket ai-ca-agent-staging-transcripts-us-east-1
aws s3api head-bucket --bucket ai-ca-agent-staging-static-us-east-1
```

**Expected:** 3 buckets (recordings, transcripts, static)

#### D. SES (Simple Email Service)

```powershell
# Check SES domain identity
aws ses get-identity-verification-attributes --identities www.soyl.cloud --region us-east-1

# Check SES email identity
aws ses get-identity-verification-attributes --identities ryangomez9965@gmail.com --region us-east-1
```

**Expected:** Domain identity for `www.soyl.cloud`, email identity for admin email

#### E. Lambda Function

```powershell
aws lambda get-function --function-name ai-ca-agent-staging-enquiry-handler --region us-east-1 --query 'Configuration.[FunctionName,Runtime,LastModified]'
```

**Expected:** Lambda function exists with Node.js runtime

#### F. API Gateway

```powershell
# Get API Gateway ID from Terraform output
terraform output -json api_gateway_url

# Or list all APIs
aws apigatewayv2 get-apis --region us-east-1 --query 'Items[*].[Name,ApiId,ApiEndpoint]'
```

**Expected:** HTTP API with name containing `ai-ca-agent-staging`

#### G. ECS Cluster & Service

```powershell
# Check ECS Cluster
aws ecs describe-clusters --clusters ai-ca-agent-staging-cluster --region us-east-1 --query 'clusters[0].[clusterName,status]'

# Check ECS Service
aws ecs describe-services --cluster ai-ca-agent-staging-cluster --services ai-ca-agent-staging-backend-service --region us-east-1 --query 'services[0].[serviceName,status,runningCount]'
```

**Expected:** Cluster and service both exist, service should show running tasks

#### H. EC2 Instance

```powershell
# Check EC2 instance
aws ec2 describe-instances --filters "Name=tag:Name,Values=ai-ca-agent-staging-ollama-instance" "Name=instance-state-name,Values=running" --region us-east-1 --query 'Reservations[0].Instances[0].[InstanceId,InstanceType,State.Name,PrivateIpAddress]'
```

**Expected:** EC2 instance running (t2.micro)

#### I. ECR Repositories

```powershell
# List ECR repositories
aws ecr describe-repositories --region us-east-1 --query 'repositories[?contains(repositoryName, `ai-ca-agent-staging`)].repositoryName'
```

**Expected:** 2 repositories (backend, worker)

## Verification Checklist

Use this checklist to verify each resource:

- [ ] **VPC** - `ai-ca-agent-staging-vpc` exists
- [ ] **Subnets** - 4 subnets exist (2 public, 2 private)
- [ ] **RDS PostgreSQL** - Database `ai-ca-agent-staging-db` is running
- [ ] **S3 Buckets** - 3 buckets exist (recordings, transcripts, static)
- [ ] **SES Domain** - Domain identity `www.soyl.cloud` exists
- [ ] **SES Email** - Email identity exists
- [ ] **Lambda** - Function `ai-ca-agent-staging-enquiry-handler` exists
- [ ] **API Gateway** - HTTP API exists and has endpoint
- [ ] **ECS Cluster** - Cluster `ai-ca-agent-staging-cluster` exists
- [ ] **ECS Service** - Service `ai-ca-agent-staging-backend-service` exists
- [ ] **EC2 Instance** - Instance `ai-ca-agent-staging-ollama-instance` is running
- [ ] **ECR Repositories** - 2 repositories exist (backend, worker)

## Quick Status Check via AWS Console

You can also verify resources in AWS Console:

1. **VPC Console**: https://console.aws.amazon.com/vpc/
   - Look for VPC named `ai-ca-agent-staging-vpc`

2. **RDS Console**: https://console.aws.amazon.com/rds/
   - Look for DB instance `ai-ca-agent-staging-db`

3. **S3 Console**: https://console.aws.amazon.com/s3/
   - Search for buckets starting with `ai-ca-agent-staging`

4. **ECS Console**: https://console.aws.amazon.com/ecs/
   - Look for cluster `ai-ca-agent-staging-cluster`

5. **EC2 Console**: https://console.aws.amazon.com/ec2/
   - Filter instances by tag: `Name = ai-ca-agent-staging-ollama-instance`

6. **Lambda Console**: https://console.aws.amazon.com/lambda/
   - Look for function `ai-ca-agent-staging-enquiry-handler`

7. **API Gateway Console**: https://console.aws.amazon.com/apigateway/
   - Look for API with name containing `ai-ca-agent-staging`

8. **SES Console**: https://console.aws.amazon.com/ses/
   - Check verified identities for domain and email

9. **ECR Console**: https://console.aws.amazon.com/ecr/
   - Look for repositories `ai-ca-agent-staging/backend` and `ai-ca-agent-staging/worker`

## Using Terraform State

The most reliable way is to check Terraform state:

```powershell
cd infra/terraform
terraform state list
```

This shows all resources managed by Terraform. You should see resources like:
- `aws_vpc.main`
- `aws_subnet.public[0]`
- `aws_subnet.public[1]`
- `aws_subnet.private[0]`
- `aws_subnet.private[1]`
- `aws_db_instance.main`
- `aws_s3_bucket.recordings`
- `aws_s3_bucket.transcripts`
- `aws_s3_bucket.static`
- `aws_ses_domain_identity.main`
- `aws_lambda_function.enquiry_handler`
- `aws_apigatewayv2_api.main`
- `aws_ecs_cluster.main`
- `aws_ecs_service.backend`
- `aws_instance.ollama`
- `aws_ecr_repository.backend`
- `aws_ecr_repository.worker`

## Troubleshooting

### If Resources Are Not Found

1. **Check Region**: Ensure you're checking `us-east-1` region
2. **Check Tags**: Resources may have different naming if not created via Terraform
3. **Check Terraform State**: Run `terraform state list` to see what Terraform thinks exists
4. **Check AWS Credentials**: Ensure your AWS CLI credentials are correct
5. **Check Permissions**: Ensure your IAM user/role has read permissions

### Common Issues

- **RDS Status**: Database may be in `creating` state (takes 5-10 minutes)
- **ECS Service**: Service may not have running tasks if image doesn't exist in ECR
- **EC2 Instance**: Instance may be stopped or starting
- **SES**: Domain may show as `Pending` until DNS record is added

## Expected Outputs

When running `terraform output`, you should see:

```
api_gateway_url = "https://<api-id>.execute-api.us-east-1.amazonaws.com"
ec2_ollama_instance_id = "i-<instance-id>"
ecr_repo_urls = {
  "backend" = "<account>.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend"
  "worker" = "<account>.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/worker"
}
ecs_cluster_name = "ai-ca-agent-staging-cluster"
lambda_function_name = "ai-ca-agent-staging-enquiry-handler"
private_subnet_ids = ["subnet-...", "subnet-..."]
public_subnet_ids = ["subnet-...", "subnet-..."]
rds_endpoint = "<sensitive>"
rds_secret_arn = "arn:aws:secretsmanager:..."
s3_bucket_names = {
  "recordings" = "ai-ca-agent-staging-recordings-us-east-1"
  "static" = "ai-ca-agent-staging-static-us-east-1"
  "transcripts" = "ai-ca-agent-staging-transcripts-us-east-1"
}
vpc_id = "vpc-..."
```

---

**Quick Command**: Run `.\scripts\verify-infrastructure.ps1` for automated verification

