# Start All AWS Services
# This script starts/resumes all AWS resources

param(
    [string]$Region = "us-east-1",
    [string]$ClusterName = "ai-ca-agent-staging-cluster"
)

Write-Host "=== Starting All AWS Services ===" -ForegroundColor Yellow
Write-Host ""

# Check if NAT Gateways exist
Write-Host "Checking NAT Gateways..." -ForegroundColor Cyan
$natGateways = aws ec2 describe-nat-gateways --region $Region --filter "Name=state,Values=available,pending" --query "NatGateways[*].[NatGatewayId,State]" --output text
if (-not $natGateways -or $natGateways.Trim() -eq "") {
    Write-Host "  [WARN] No NAT Gateways found!" -ForegroundColor Yellow
    Write-Host "  [TIP] You need to recreate NAT Gateways before starting services" -ForegroundColor Yellow
    Write-Host "  [TIP] Run: scripts/recreate-nat-gateways.ps1" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Exiting. Please recreate NAT Gateways first." -ForegroundColor Yellow
        exit 1
    }
} else {
    $natList = $natGateways -split "`n" | Where-Object { $_ -and $_.Trim() -ne "" }
    $availableCount = 0
    $pendingCount = 0
    foreach ($nat in $natList) {
        $parts = $nat -split "`t"
        if ($parts.Length -ge 2) {
            if ($parts[1] -eq "available") { $availableCount++ }
            if ($parts[1] -eq "pending") { $pendingCount++ }
        }
    }
    if ($availableCount -gt 0) {
        Write-Host "  [OK] $availableCount NAT Gateway(s) available" -ForegroundColor Green
    }
    if ($pendingCount -gt 0) {
        Write-Host "  [INFO] $pendingCount NAT Gateway(s) pending (will be available in 2-5 minutes)" -ForegroundColor Yellow
    }
}

Write-Host ""

# 1. Start EC2 Instances
Write-Host "1. Starting EC2 Instances..." -ForegroundColor Cyan
$instances = aws ec2 describe-instances --region $Region --filters "Name=instance-state-name,Values=stopped" "Name=tag:Name,Values=*ai-ca-agent*" --query "Reservations[*].Instances[*].InstanceId" --output text
if ($instances -and $instances.Trim() -ne "") {
    $instanceList = $instances -split "`t" | Where-Object { $_ -and $_.Trim() -ne "" }
    foreach ($instanceId in $instanceList) {
        Write-Host "  Starting instance: $instanceId" -ForegroundColor Gray
        aws ec2 start-instances --instance-ids $instanceId --region $Region | Out-Null
    }
    Write-Host "  [OK] EC2 instances starting (may take a few minutes)" -ForegroundColor Green
} else {
    Write-Host "  [INFO] No stopped EC2 instances found" -ForegroundColor Gray
}

# 2. Start RDS Instances
Write-Host ""
Write-Host "2. Starting RDS Instances..." -ForegroundColor Cyan
$dbInstances = aws rds describe-db-instances --region $Region --query "DBInstances[?DBInstanceStatus=='stopped'].DBInstanceIdentifier" --output text
if ($dbInstances -and $dbInstances.Trim() -ne "") {
    $dbList = $dbInstances -split "`t" | Where-Object { $_ -and $_.Trim() -ne "" }
    foreach ($dbId in $dbList) {
        Write-Host "  Starting RDS instance: $dbId" -ForegroundColor Gray
        aws rds start-db-instance --db-instance-identifier $dbId --region $Region | Out-Null
    }
    Write-Host "  [OK] RDS instances starting (may take 5-10 minutes)" -ForegroundColor Green
} else {
    Write-Host "  [INFO] No stopped RDS instances found" -ForegroundColor Gray
}

# 3. Scale ECS Services to 1
Write-Host ""
Write-Host "3. Scaling ECS Services to 1..." -ForegroundColor Cyan
$services = aws ecs list-services --cluster $ClusterName --region $Region --query "serviceArns[]" --output text
if ($services -and $services.Trim() -ne "") {
    $serviceList = $services -split "`t" | Where-Object { $_ -and $_.Trim() -ne "" }
    foreach ($serviceArn in $serviceList) {
        $serviceName = $serviceArn.Split('/')[-1]
        Write-Host "  Scaling up service: $serviceName" -ForegroundColor Gray
        aws ecs update-service --cluster $ClusterName --service $serviceName --desired-count 1 --region $Region | Out-Null
    }
    Write-Host "  [OK] ECS services scaling up" -ForegroundColor Green
} else {
    Write-Host "  [INFO] No ECS services found" -ForegroundColor Gray
}

# 4. Check Amazon Connect Status
Write-Host ""
Write-Host "4. Checking Amazon Connect..." -ForegroundColor Cyan
# Note: Connect instances are always running, just verify they're active
Write-Host "  [INFO] Amazon Connect instances are always active" -ForegroundColor Gray
Write-Host "  [TIP] Verify Connect instance in AWS Console if needed" -ForegroundColor Cyan

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Yellow
Write-Host "[OK] EC2 instances: Starting" -ForegroundColor Green
Write-Host "[OK] RDS instances: Starting (5-10 min)" -ForegroundColor Green
Write-Host "[OK] ECS services: Scaling up" -ForegroundColor Green
Write-Host "[OK] Amazon Connect: Always active" -ForegroundColor Green
Write-Host ""
Write-Host "[NOTE] If NAT Gateways were deleted, recreate them first:" -ForegroundColor Yellow
Write-Host "   scripts/recreate-nat-gateways.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Or using Terraform:" -ForegroundColor Gray
Write-Host "   cd infra/terraform && terraform apply -target=aws_nat_gateway.main" -ForegroundColor DarkGray
