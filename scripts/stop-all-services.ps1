# Stop All AWS Services to Save Costs
# This script stops/suspends all running AWS resources

param(
    [string]$Region = "us-east-1",
    [string]$ClusterName = "ai-ca-agent-staging-cluster",
    [switch]$SkipNATGateways = $false  # NAT Gateways cost money even when stopped, need to delete
)

Write-Host "=== Stopping All AWS Services ===" -ForegroundColor Yellow
Write-Host ""

# 1. Stop EC2 Instances
Write-Host "1. Stopping EC2 Instances..." -ForegroundColor Cyan
$instances = aws ec2 describe-instances --region $Region --filters "Name=instance-state-name,Values=running" "Name=tag:Name,Values=*ai-ca-agent*" --query "Reservations[*].Instances[*].InstanceId" --output text
if ($instances) {
    $instanceList = $instances -split "`t" | Where-Object { $_ }
    foreach ($instanceId in $instanceList) {
        Write-Host "  Stopping instance: $instanceId" -ForegroundColor Gray
        aws ec2 stop-instances --instance-ids $instanceId --region $Region | Out-Null
    }
    Write-Host "  ✅ EC2 instances stopped" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  No EC2 instances running" -ForegroundColor Gray
}

# 2. Scale ECS Services to 0 (Fargate - no charge when scaled to 0)
Write-Host ""
Write-Host "2. Scaling ECS Services to 0 (Fargate - stops all charges)..." -ForegroundColor Cyan
$services = aws ecs list-services --cluster $ClusterName --region $Region --query "serviceArns[]" --output text
if ($services) {
    $serviceList = $services -split "`t" | Where-Object { $_ }
    foreach ($serviceArn in $serviceList) {
        $serviceName = $serviceArn.Split('/')[-1]
        Write-Host "  Scaling down service: $serviceName" -ForegroundColor Gray
        aws ecs update-service --cluster $ClusterName --service $serviceName --desired-count 0 --region $Region | Out-Null
    }
    Write-Host "  ✅ ECS services scaled to 0 (no charges when at 0)" -ForegroundColor Green
    Write-Host "  💡 Fargate only charges when tasks are running" -ForegroundColor Gray
} else {
    Write-Host "  ℹ️  No ECS services found" -ForegroundColor Gray
}

# 3. Stop RDS Instances (if supported)
Write-Host ""
Write-Host "3. Stopping RDS Instances..." -ForegroundColor Cyan
$dbInstances = aws rds describe-db-instances --region $Region --query "DBInstances[?DBInstanceStatus=='available'].DBInstanceIdentifier" --output text
if ($dbInstances) {
    $dbList = $dbInstances -split "`t" | Where-Object { $_ }
    foreach ($dbId in $dbList) {
        Write-Host "  Stopping RDS instance: $dbId" -ForegroundColor Gray
        # Note: RDS can be stopped, but some instance types don't support it
        # Multi-AZ deployments need to be converted to Single-AZ first
        try {
            aws rds stop-db-instance --db-instance-identifier $dbId --region $Region | Out-Null
            Write-Host "  ✅ RDS instance $dbId stop initiated" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  RDS instance $dbId may not support stopping (check instance type)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ℹ️  No RDS instances found" -ForegroundColor Gray
}

# 4. Delete NAT Gateways (they cost money even when idle)
if (-not $SkipNATGateways) {
    Write-Host ""
    Write-Host "4. Deleting NAT Gateways (they cost ~$0.045/hour even when idle)..." -ForegroundColor Cyan
    $natGateways = aws ec2 describe-nat-gateways --region $Region --filter "Name=state,Values=available" --query "NatGateways[*].NatGatewayId" --output text
    if ($natGateways) {
        $natList = $natGateways -split "`t" | Where-Object { $_ }
        foreach ($natId in $natList) {
            Write-Host "  Deleting NAT Gateway: $natId" -ForegroundColor Gray
            aws ec2 delete-nat-gateway --nat-gateway-id $natId --region $Region | Out-Null
        }
        Write-Host "  ✅ NAT Gateways deleted (will save ~$32/month each)" -ForegroundColor Green
        Write-Host "  ⚠️  Note: You'll need to recreate NAT Gateways when restarting services" -ForegroundColor Yellow
    } else {
        Write-Host "  ℹ️  No NAT Gateways found" -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "4. Skipping NAT Gateways (use -SkipNATGateways:$false to delete them)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Yellow
Write-Host "✅ EC2 instances: Stopped" -ForegroundColor Green
Write-Host "✅ ECS services: Scaled to 0" -ForegroundColor Green
Write-Host "✅ RDS instances: Stop initiated" -ForegroundColor Green
if (-not $SkipNATGateways) {
    Write-Host "✅ NAT Gateways: Deleted (saves ~$32/month each)" -ForegroundColor Green
}
Write-Host ""
Write-Host "💡 Estimated monthly savings:" -ForegroundColor Cyan
Write-Host "   - EC2 (Ollama): ~$15-100/month (stopped = $0)" -ForegroundColor Gray
Write-Host "   - ECS Fargate: ~$15-30/month (scaled to 0 = $0)" -ForegroundColor Gray
Write-Host "   - RDS: ~$50-200/month (stopped = $0)" -ForegroundColor Gray
Write-Host "   - NAT Gateway: ~$32/month each (deleted = $0)" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Important Notes:" -ForegroundColor Yellow
Write-Host "   - ECS Fargate uses NO EC2 instances" -ForegroundColor Gray
Write-Host "   - Just scale desired-count to 0 (no need to delete/recreate)" -ForegroundColor Gray
Write-Host "   - Fargate only charges when tasks are actually running" -ForegroundColor Gray
Write-Host ""
Write-Host "To restart services, use: scripts/start-all-services.ps1" -ForegroundColor Yellow

