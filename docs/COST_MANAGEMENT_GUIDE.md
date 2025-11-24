# Cost Management Guide for Development

## Overview

This guide explains how to manage AWS costs during development by stopping services when not in use.

## Cost-Bearing Services

### High Cost Services (Stop These First)
1. **NAT Gateways**: ~$32/month each (even when idle) - **DELETE when not needed**
2. **RDS Instances**: ~$50-200/month depending on instance type
3. **EC2 GPU Instances**: ~$100-500/month depending on instance type
4. **EC2 Regular Instances**: ~$15-50/month

### Low/No Cost Services (Can Leave Running)
- **S3 Buckets**: Only pay for storage (~$0.023/GB/month)
- **Lambda Functions**: Pay per invocation (very cheap)
- **API Gateway**: Pay per request (very cheap)
- **ECS Fargate**: Only pay for running tasks (can scale to 0)
- **ECR**: Only pay for storage (~$0.10/GB/month)
- **Secrets Manager**: ~$0.40/secret/month
- **CloudWatch Logs**: ~$0.50/GB ingested

## Quick Stop/Start Scripts

### Stop All Services
```powershell
.\scripts\stop-all-services.ps1
```

This will:
- Stop all EC2 instances
- Scale ECS services to 0
- Stop RDS instances (if supported)
- Delete NAT Gateways (saves ~$32/month each)

### Start All Services
```powershell
.\scripts\start-all-services.ps1
```

This will:
- Start all EC2 instances
- Start RDS instances (takes 5-10 minutes)
- Scale ECS services to 1

## Manual Commands

### Stop EC2 Instance
```bash
aws ec2 stop-instances --instance-ids i-xxxxxxxxx --region us-east-1
```

### Start EC2 Instance
```bash
aws ec2 start-instances --instance-ids i-xxxxxxxxx --region us-east-1
```

### Scale ECS Service to 0
```bash
aws ecs update-service \
  --cluster ai-ca-agent-staging-cluster \
  --service ai-ca-agent-staging-backend-service \
  --desired-count 0 \
  --region us-east-1
```

### Scale ECS Service to 1
```bash
aws ecs update-service \
  --cluster ai-ca-agent-staging-cluster \
  --service ai-ca-agent-staging-backend-service \
  --desired-count 1 \
  --region us-east-1
```

### Stop RDS Instance
```bash
aws rds stop-db-instance \
  --db-instance-identifier ai-ca-agent-staging-db \
  --region us-east-1
```

**Note**: Not all RDS instance types support stopping. Multi-AZ deployments need to be converted to Single-AZ first.

### Start RDS Instance
```bash
aws rds start-db-instance \
  --db-instance-identifier ai-ca-agent-staging-db \
  --region us-east-1
```

### Delete NAT Gateway (Saves ~$32/month)
```bash
aws ec2 delete-nat-gateway --nat-gateway-id nat-xxxxxxxxx --region us-east-1
```

**Important**: You'll need to recreate NAT Gateways via Terraform when restarting:
```bash
cd infra/terraform
terraform apply -target=aws_nat_gateway.main
```

## Development Workflow Recommendations

### Option 1: Stop Everything When Not Working
**Best for**: Occasional development, cost-sensitive projects

1. **End of Day**:
   ```powershell
   .\scripts\stop-all-services.ps1
   ```

2. **Start of Day**:
   ```powershell
   .\scripts\start-all-services.ps1
   # Wait 5-10 minutes for RDS to start
   ```

**Estimated Cost**: ~$0/day when stopped (except S3 storage)

### Option 2: Keep Only Essential Services
**Best for**: Active development, need quick access

**Keep Running**:
- S3 buckets
- Lambda functions
- API Gateway
- Secrets Manager

**Stop When Not Needed**:
- EC2 instances (Ollama)
- RDS (if not actively testing DB features)
- ECS services (scale to 0)
- NAT Gateways (delete if not needed)

**Estimated Cost**: ~$1-5/day

### Option 3: Use Smaller Instance Types for Development
**Best for**: Continuous development

Modify `infra/terraform/terraform.tfvars`:
```hcl
# Use smaller/cheaper instances for dev
ec2_instance_type = "t3.medium"  # Instead of g4dn.xlarge
db_instance_class = "db.t3.micro"  # Instead of db.t3.medium
```

**Estimated Cost**: ~$50-100/month

## Cost Monitoring

### Check Current Costs
```bash
# View cost and usage report (requires Cost Explorer enabled)
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --region us-east-1
```

### Set Up Billing Alerts
1. Go to AWS Billing Console
2. Create a billing alarm in CloudWatch
3. Set threshold (e.g., $50/month)

## Terraform State Management

### Important Notes
- **Don't destroy infrastructure** - just stop services
- Terraform state tracks resources even when stopped
- Use `terraform plan` to see what will change

### Safe Commands
```bash
# Check what's running
terraform plan

# Stop services (via scripts, not terraform destroy)
.\scripts\stop-all-services.ps1

# When ready to work again
.\scripts\start-all-services.ps1
```

## NAT Gateway Cost Optimization

NAT Gateways are expensive (~$32/month each) and cost money even when idle.

### Option 1: Delete When Not Needed
```bash
# Delete NAT Gateways
aws ec2 delete-nat-gateway --nat-gateway-id nat-xxx --region us-east-1

# Recreate when needed
cd infra/terraform
terraform apply -target=aws_nat_gateway.main
```

### Option 2: Use NAT Instances (Cheaper Alternative)
- Cost: ~$15/month for t3.micro instance
- Trade-off: Less reliable, need to manage yourself
- Update Terraform to use `aws_instance` instead of `aws_nat_gateway`

## Estimated Monthly Costs

### Full Stack Running 24/7
- EC2 GPU (g4dn.xlarge): ~$200/month
- RDS (db.t3.medium): ~$50/month
- NAT Gateways (2x): ~$64/month
- ECS Fargate: ~$30/month (1 task)
- Other services: ~$10/month
- **Total: ~$354/month**

### Development (Stop/Start Daily)
- EC2: ~$0 (stopped)
- RDS: ~$0 (stopped)
- NAT Gateways: ~$0 (deleted)
- ECS: ~$0 (scaled to 0)
- S3/Other: ~$5/month
- **Total: ~$5/month**

### Minimal Running (Essential Only)
- EC2: ~$0 (stopped)
- RDS: ~$0 (stopped)
- NAT Gateways: ~$0 (deleted)
- ECS: ~$0 (scaled to 0)
- Lambda/API Gateway: ~$1/month
- S3/Other: ~$5/month
- **Total: ~$6/month**

## Best Practices

1. **Always delete NAT Gateways** when not actively developing
2. **Stop RDS** when not testing database features
3. **Scale ECS to 0** when not testing backend
4. **Stop EC2** when not testing LLM/Ollama
5. **Set up billing alerts** to monitor costs
6. **Use smaller instance types** for development
7. **Review costs weekly** in AWS Cost Explorer

## Emergency Cost Reduction

If costs are getting out of control:

```powershell
# Stop everything immediately
.\scripts\stop-all-services.ps1 -SkipNATGateways:$false

# Delete NAT Gateways manually if script fails
aws ec2 describe-nat-gateways --region us-east-1 --query "NatGateways[*].NatGatewayId" --output text | ForEach-Object { aws ec2 delete-nat-gateway --nat-gateway-id $_ --region us-east-1 }
```

## Restoring Services

When ready to work again:

1. **Recreate NAT Gateways** (if deleted):
   ```bash
   cd infra/terraform
   terraform apply -target=aws_nat_gateway.main
   ```

2. **Start all services**:
   ```powershell
   .\scripts\start-all-services.ps1
   ```

3. **Wait for services**:
   - EC2: 2-5 minutes
   - RDS: 5-10 minutes
   - ECS: 2-3 minutes

4. **Verify services are running**:
   ```bash
   aws ec2 describe-instances --filters "Name=instance-state-name,Values=running"
   aws rds describe-db-instances --query "DBInstances[*].DBInstanceStatus"
   aws ecs describe-services --cluster ai-ca-agent-staging-cluster --services ai-ca-agent-staging-backend-service
   ```

