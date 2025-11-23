# ECS Deployment Guide

This guide explains how to deploy your application containers to AWS ECS using ECR repositories.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Docker** installed and running
3. **Terraform** infrastructure already deployed
4. **Application code** ready in `services/backend` and `services/worker`

## ECR Repository URLs

From your Terraform outputs:

- **Backend ECR:** `381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend`
- **Worker ECR:** `381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/worker`
- **Region:** `us-east-1`
- **ECS Cluster:** `ai-ca-agent-staging-cluster`

## Step-by-Step Deployment Process

### Step 1: Authenticate Docker to ECR

AWS ECR requires authentication before you can push images. Run this command:

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 381492072674.dkr.ecr.us-east-1.amazonaws.com
```

**Windows PowerShell:**
```powershell
$password = aws ecr get-login-password --region us-east-1
$password | docker login --username AWS --password-stdin 381492072674.dkr.ecr.us-east-1.amazonaws.com
```

**Note:** This authentication is valid for 12 hours. You'll need to re-authenticate if it expires.

### Step 2: Build Docker Images

Build the Docker images for both services:

**Backend:**
```bash
cd services/backend
docker build -t ai-ca-agent-staging-backend:latest .
```

**Worker:**
```bash
cd services/worker
docker build -t ai-ca-agent-staging-worker:latest .
```

Or build both from the project root:
```bash
docker build -t ai-ca-agent-staging-backend:latest -f services/backend/Dockerfile services/backend
docker build -t ai-ca-agent-staging-worker:latest -f services/worker/Dockerfile services/worker
```

### Step 3: Tag Images for ECR

Tag the images with your ECR repository URLs:

**Backend:**
```bash
docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
```

**Worker:**
```bash
docker tag ai-ca-agent-staging-worker:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/worker:latest
```

**Optional - Tag with version:**
You can also tag with version numbers for better versioning:
```bash
VERSION="v1.0.0"
docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:$VERSION
docker tag ai-ca-agent-staging-worker:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/worker:$VERSION
```

### Step 4: Push Images to ECR

Push the tagged images to ECR:

**Backend:**
```bash
docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
```

**Worker:**
```bash
docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/worker:latest
```

**Note:** First push may take a few minutes depending on image size and network speed.

### Step 5: Update ECS Task Definition

After pushing images, you need to update your ECS task definition. The Terraform configuration already references the ECR images, but you have two options:

#### Option A: Force ECS Service Update via Terraform

Since Terraform already references `:latest`, you can force ECS to pull a new image by updating the task definition:

```bash
cd infra/terraform
terraform apply -target=aws_ecs_task_definition.backend -auto-approve
terraform apply -target=aws_ecs_service.backend -auto-approve
```

#### Option B: Update ECS Service via AWS CLI (Force New Deployment)

Force ECS to do a new deployment which will pull the latest image:

```bash
aws ecs update-service \
  --cluster ai-ca-agent-staging-cluster \
  --service ai-ca-agent-staging-backend-service \
  --force-new-deployment \
  --region us-east-1
```

This will trigger ECS to:
1. Pull the latest image from ECR
2. Create new tasks
3. Replace old tasks gradually (rolling update)

### Step 6: Verify Deployment

Check the status of your ECS service:

```bash
aws ecs describe-services \
  --cluster ai-ca-agent-staging-cluster \
  --services ai-ca-agent-staging-backend-service \
  --region us-east-1
```

Check running tasks:

```bash
aws ecs list-tasks \
  --cluster ai-ca-agent-staging-cluster \
  --service-name ai-ca-agent-staging-backend-service \
  --region us-east-1
```

View logs in CloudWatch:

```bash
aws logs tail /ecs/ai-ca-agent-staging --follow --region us-east-1
```

Or view logs in AWS Console:
1. Go to CloudWatch → Log groups
2. Select `/ecs/ai-ca-agent-staging`
3. Select the `backend` stream

## Automated Deployment Script

I've created deployment scripts to automate this process. See:
- `scripts/deploy-backend.ps1` (Windows PowerShell)
- `scripts/deploy-worker.ps1` (Windows PowerShell)
- `scripts/deploy-all.sh` (Linux/Mac)

## Environment Variables

Your ECS task definition already includes:
- `NODE_ENV`: Set to `staging`
- `DB_SECRET_ARN`: ARN of the RDS credentials secret

To add more environment variables, update `infra/terraform/ecs.tf` and run `terraform apply`.

## Worker Service Deployment

Currently, only the backend service has an ECS task definition. To deploy the worker service:

1. **Create ECS Task Definition for Worker** (add to `infra/terraform/ecs.tf`)
2. **Create ECS Service for Worker**
3. Follow the same deployment steps as backend

## Troubleshooting

### Image Pull Errors

If ECS can't pull images:
1. Verify image exists in ECR: `aws ecr describe-images --repository-name ai-ca-agent-staging/backend --region us-east-1`
2. Check ECS execution role has ECR permissions (already configured in Terraform)
3. Verify task definition image URI is correct

### Task Stops Immediately

Check CloudWatch logs:
```bash
aws logs tail /ecs/ai-ca-agent-staging --follow
```

Common issues:
- Application crashes on startup
- Missing environment variables
- Database connection errors
- Missing IAM permissions

### Deployment Takes Too Long

- Check if NAT Gateway is working (required for private subnets)
- Verify security groups allow outbound traffic
- Check CloudWatch logs for errors

### Service Won't Start Tasks

- Check task definition CPU/memory requirements (currently 256 CPU, 512 MB memory)
- Verify security groups are correctly configured
- Check ECS service desired count (currently 1)

## Updating Application Code

To update the application after code changes:

1. **Build new image:**
   ```bash
   docker build -t ai-ca-agent-staging-backend:latest -f services/backend/Dockerfile services/backend
   ```

2. **Tag and push:**
   ```bash
   docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
   docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
   ```

3. **Force ECS deployment:**
   ```bash
   aws ecs update-service \
     --cluster ai-ca-agent-staging-cluster \
     --service ai-ca-agent-staging-backend-service \
     --force-new-deployment \
     --region us-east-1
   ```

## Best Practices

1. **Version Tagging:** Use version tags instead of `:latest` for production
2. **Image Scanning:** ECR is configured to scan images on push (already enabled)
3. **Rolling Updates:** ECS performs rolling updates automatically
4. **Health Checks:** Implement health check endpoints in your application
5. **Logging:** All logs go to CloudWatch (already configured)
6. **Monitoring:** Enable Container Insights (already enabled in cluster)

## CI/CD Integration

For automated deployments, you can integrate these steps into your CI/CD pipeline:

1. **Build and test** application code
2. **Build Docker image** with version tag
3. **Run security scans** on image
4. **Push to ECR** with version tag
5. **Update ECS task definition** with new image version
6. **Deploy to ECS** service
7. **Run smoke tests** after deployment
8. **Monitor** deployment in CloudWatch

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [ECS Task Definitions](https://docs.aws.amazon.com/ecs/latest/developerguide/task_definitions.html)
- [ECS Service Updates](https://docs.aws.amazon.com/ecs/latest/developerguide/service-update.html)

