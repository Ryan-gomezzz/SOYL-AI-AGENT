# Start All AWS Services
# This script starts/resumes all AWS resources

param(
    [string]$Region = "us-east-1",
    [string]$ClusterName = "ai-ca-agent-staging-cluster"
)

Write-Host "=== Starting All AWS Services ===" -ForegroundColor Yellow
Write-Host ""

# 1. Start EC2 Instances
Write-Host "1. Starting EC2 Instances..." -ForegroundColor Cyan
$instances = aws ec2 describe-instances --region $Region --filters "Name=instance-state-name,Values=stopped" "Name=tag:Name,Values=*ai-ca-agent*" --query "Reservations[*].Instances[*].InstanceId" --output text
if ($instances) {
    $instanceList = $instances -split "`t" | Where-Object { $_ }
    foreach ($instanceId in $instanceList) {
        Write-Host "  Starting instance: $instanceId" -ForegroundColor Gray
        aws ec2 start-instances --instance-ids $instanceId --region $Region | Out-Null
    }
    Write-Host "  ✅ EC2 instances starting (may take a few minutes)" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No stopped EC2 instances found" -ForegroundColor Gray
}

# 2. Start RDS Instances
Write-Host ""
Write-Host "2. Starting RDS Instances..." -ForegroundColor Cyan
$dbInstances = aws rds describe-db-instances --region $Region --query "DBInstances[?DBInstanceStatus=='stopped'].DBInstanceIdentifier" --output text
if ($dbInstances) {
    $dbList = $dbInstances -split "`t" | Where-Object { $_ }
    foreach ($dbId in $dbList) {
        Write-Host "  Starting RDS instance: $dbId" -ForegroundColor Gray
        aws rds start-db-instance --db-instance-identifier $dbId --region $Region | Out-Null
    }
    Write-Host "  ✅ RDS instances starting (may take 5-10 minutes)" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No stopped RDS instances found" -ForegroundColor Gray
}

# 3. Scale ECS Services to 1
Write-Host ""
Write-Host "3. Scaling ECS Services to 1..." -ForegroundColor Cyan
$services = aws ecs list-services --cluster $ClusterName --region $Region --query "serviceArns[]" --output text
if ($services) {
    $serviceList = $services -split "`t" | Where-Object { $_ }
    foreach ($serviceArn in $serviceList) {
        $serviceName = $serviceArn.Split('/')[-1]
        Write-Host "  Scaling up service: $serviceName" -ForegroundColor Gray
        aws ecs update-service --cluster $ClusterName --service $serviceName --desired-count 1 --region $Region | Out-Null
    }
    Write-Host "  ✅ ECS services scaling up" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No ECS services found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Yellow
Write-Host "✅ EC2 instances: Starting" -ForegroundColor Green
Write-Host "✅ RDS instances: Starting (5-10 min)" -ForegroundColor Green
Write-Host "✅ ECS services: Scaling up" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Note: If NAT Gateways were deleted, you'll need to recreate them via Terraform" -ForegroundColor Yellow
Write-Host "   Run: cd infra/terraform && terraform apply -target=aws_nat_gateway.main" -ForegroundColor Gray

