# ECS Cost Management Guide

## Understanding ECS Fargate vs EC2 Launch Type

### Your Setup: ECS Fargate ✅
- **Launch Type**: `FARGATE`
- **EC2 Instances Required**: **NONE**
- **How It Works**: AWS manages the infrastructure for you
- **Charging Model**: Pay only for running tasks (CPU + Memory + Duration)

### ECS EC2 Launch Type (Not Your Setup)
- **Launch Type**: `EC2`
- **EC2 Instances Required**: YES (you manage them)
- **How It Works**: You provision EC2 instances, ECS runs tasks on them
- **Charging Model**: Pay for EC2 instances 24/7 + ECS service charges

## Cost Breakdown

### ECS Fargate Pricing
- **CPU**: ~$0.04048 per vCPU per hour
- **Memory**: ~$0.004445 per GB per hour
- **Your Task**: 256 CPU units (0.25 vCPU) + 512 MB (0.5 GB)
- **Hourly Cost**: ~$0.01012 + $0.00222 = **~$0.012/hour**
- **Daily Cost**: ~$0.29/day
- **Monthly Cost**: ~$8.70/month (if running 24/7)

### When Scaled to 0
- **Cost**: **$0** (no charges at all)
- **No EC2 instances to manage**
- **No infrastructure to delete**

## How to Stop ECS Charges

### Method 1: Scale Service to 0 (Recommended)
```powershell
aws ecs update-service \
  --cluster ai-ca-agent-staging-cluster \
  --service ai-ca-agent-staging-backend-service \
  --desired-count 0 \
  --region us-east-1
```

**Result**: 
- ✅ All tasks stopped
- ✅ Cost drops to $0
- ✅ Service definition remains (easy to restart)
- ✅ No need to delete/recreate anything

### Method 2: Use Stop Script
```powershell
.\scripts\stop-all-services.ps1
```

This automatically scales ECS services to 0.

## How to Restart ECS Service

### Scale Back to 1
```powershell
aws ecs update-service \
  --cluster ai-ca-agent-staging-cluster \
  --service ai-ca-agent-staging-backend-service \
  --desired-count 1 \
  --region us-east-1
```

**Result**:
- ✅ Tasks start automatically
- ✅ Service resumes normal operation
- ✅ Takes 1-2 minutes to start

### Use Start Script
```powershell
.\scripts\start-all-services.ps1
```

## Common Misconceptions

### ❌ "I need to delete EC2 instances for ECS"
**Reality**: ECS Fargate doesn't use EC2 instances. The only EC2 instance you have is for Ollama (LLM), which is separate.

### ❌ "I need to delete and recreate ECS service"
**Reality**: Just scale `desired-count` to 0. The service definition stays, ready to restart.

### ❌ "ECS charges even when stopped"
**Reality**: Fargate only charges when tasks are running. At 0 tasks = $0 cost.

## Current Status

### ECS Service Status
- **Launch Type**: FARGATE ✅
- **Desired Count**: 1
- **Running Count**: 0 (already stopped)
- **Current Cost**: $0 (no tasks running)

### EC2 Instance Status
- **Instance**: `i-0548f3187e7f87967` (Ollama)
- **Purpose**: LLM/Ollama service (NOT for ECS)
- **Status**: Stopped
- **Cost**: $0 (stopped)

## Cost Optimization Tips

### 1. Scale to 0 When Not Working
```powershell
# End of day
.\scripts\stop-all-services.ps1

# Start of day
.\scripts\start-all-services.ps1
```

### 2. Use Smaller Task Sizes for Development
Edit `infra/terraform/ecs.tf`:
```hcl
cpu    = "256"   # 0.25 vCPU (minimum)
memory = "512"   # 512 MB (minimum)
```

### 3. Monitor Task Usage
```powershell
aws ecs describe-services \
  --cluster ai-ca-agent-staging-cluster \
  --services ai-ca-agent-staging-backend-service \
  --region us-east-1 \
  --query "services[0].{Desired:desiredCount,Running:runningCount}"
```

## FAQ

### Q: Do I need to delete ECS service to stop charges?
**A**: No! Just scale `desired-count` to 0. The service stays defined but no tasks run = no charges.

### Q: Will I lose my service configuration if I scale to 0?
**A**: No! All configuration (task definition, networking, etc.) is preserved. Just scale back up when needed.

### Q: How long does it take to restart?
**A**: 1-2 minutes. Tasks start automatically when you scale back to 1.

### Q: What about the EC2 instance?
**A**: That's for Ollama (LLM), not ECS. It's separate and can be stopped independently.

### Q: Can I use EC2 launch type instead?
**A**: Yes, but it's more complex and requires managing EC2 instances. Fargate is simpler and better for most use cases.

## Summary

✅ **Your ECS uses Fargate** - No EC2 instances needed
✅ **Scale to 0** - Stops all charges immediately
✅ **No deletion needed** - Service definition stays ready
✅ **Easy restart** - Just scale back to 1
✅ **Current cost**: $0 (already scaled to 0)

**Best Practice**: Use the stop/start scripts to manage costs during development.

