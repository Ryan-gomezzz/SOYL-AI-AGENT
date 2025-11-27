# Recreate NAT Gateways for Testing
# This script recreates NAT Gateways that were deleted to save costs
# Uses Terraform to ensure proper configuration

param(
    [string]$Region = "us-east-1",
    [string]$TerraformDir = "infra/terraform"
)

Write-Host "=== Recreating NAT Gateways ===" -ForegroundColor Yellow
Write-Host ""

# Check if Terraform is available
$terraformAvailable = Get-Command terraform -ErrorAction SilentlyContinue

if ($terraformAvailable) {
    Write-Host "Using Terraform to recreate NAT Gateways..." -ForegroundColor Cyan
    Write-Host ""
    
    # Change to Terraform directory
    Push-Location $TerraformDir
    
    try {
        # Initialize Terraform if needed
        if (-not (Test-Path ".terraform")) {
            Write-Host "Initializing Terraform..." -ForegroundColor Gray
            terraform init | Out-Null
        }
        
        # Apply only NAT Gateway resources (and their dependencies)
        Write-Host "Recreating NAT Gateways and Elastic IPs..." -ForegroundColor Cyan
        Write-Host "  This will create:" -ForegroundColor Gray
        Write-Host "    - 2 Elastic IPs (one per NAT Gateway)" -ForegroundColor Gray
        Write-Host "    - 2 NAT Gateways (one per public subnet)" -ForegroundColor Gray
        Write-Host "    - Update private route tables" -ForegroundColor Gray
        Write-Host ""
        
        terraform apply -target=aws_eip.nat -target=aws_nat_gateway.main -target=aws_route_table.private -auto-approve
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ NAT Gateways recreated successfully!" -ForegroundColor Green
            Write-Host "   Note: NAT Gateways take 2-5 minutes to become available" -ForegroundColor Yellow
        } else {
            Write-Host ""
            Write-Host "❌ Error recreating NAT Gateways" -ForegroundColor Red
            Write-Host "   Check Terraform output above for details" -ForegroundColor Yellow
        }
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "⚠️  Terraform not found. Using AWS CLI to recreate NAT Gateways..." -ForegroundColor Yellow
    Write-Host ""
    
    # Get VPC ID
    Write-Host "Finding VPC..." -ForegroundColor Cyan
    $vpcId = aws ec2 describe-vpcs --region $Region --filters "Name=tag:Name,Values=*ai-ca-agent*vpc" --query "Vpcs[0].VpcId" --output text
    
    if (-not $vpcId -or $vpcId -eq "None") {
        Write-Host "❌ Could not find VPC. Please check your AWS configuration." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Found VPC: $vpcId" -ForegroundColor Gray
    
    # Get public subnets
    Write-Host ""
    Write-Host "Finding public subnets..." -ForegroundColor Cyan
    $publicSubnets = aws ec2 describe-subnets --region $Region --filters "Name=vpc-id,Values=$vpcId" "Name=tag:Type,Values=public" --query "Subnets[*].[SubnetId,AvailabilityZone]" --output text
    
    if (-not $publicSubnets) {
        Write-Host "❌ Could not find public subnets." -ForegroundColor Red
        exit 1
    }
    
    $subnetList = $publicSubnets -split "`n" | Where-Object { $_ }
    $subnetIds = @()
    $azs = @()
    
    foreach ($line in $subnetList) {
        $parts = $line -split "`t"
        if ($parts.Length -eq 2) {
            $subnetIds += $parts[0]
            $azs += $parts[1]
        }
    }
    
    Write-Host "  Found $($subnetIds.Count) public subnet(s)" -ForegroundColor Gray
    
    # Get Internet Gateway
    Write-Host ""
    Write-Host "Finding Internet Gateway..." -ForegroundColor Cyan
    $igwId = aws ec2 describe-internet-gateways --region $Region --filters "Name=attachment.vpc-id,Values=$vpcId" --query "InternetGateways[0].InternetGatewayId" --output text
    
    if (-not $igwId -or $igwId -eq "None") {
        Write-Host "❌ Could not find Internet Gateway." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  Found IGW: $igwId" -ForegroundColor Gray
    
    # Create Elastic IPs and NAT Gateways
    Write-Host ""
    Write-Host "Creating NAT Gateways..." -ForegroundColor Cyan
    
    for ($i = 0; $i -lt $subnetIds.Count; $i++) {
        $subnetId = $subnetIds[$i]
        $az = $azs[$i]
        
        Write-Host "  Creating NAT Gateway $($i + 1) in $az..." -ForegroundColor Gray
        
        # Allocate Elastic IP
        $eipAllocation = aws ec2 allocate-address --domain vpc --region $Region --query "[AllocationId,PublicIp]" --output text
        $eipParts = $eipAllocation -split "`t"
        $allocationId = $eipParts[0]
        $publicIp = $eipParts[1]
        
        Write-Host "    Allocated Elastic IP: $publicIp ($allocationId)" -ForegroundColor Gray
        
        # Create NAT Gateway
        $natGateway = aws ec2 create-nat-gateway --subnet-id $subnetId --allocation-id $allocationId --region $Region --query "[NatGatewayId,State]" --output text
        $natParts = $natGateway -split "`t"
        $natId = $natParts[0]
        $natState = $natParts[1]
        
        Write-Host "    Created NAT Gateway: $natId (State: $natState)" -ForegroundColor Gray
        
        # Update private route table
        Write-Host "    Updating private route table..." -ForegroundColor Gray
        $privateRouteTables = aws ec2 describe-route-tables --region $Region --filters "Name=vpc-id,Values=$vpcId" "Name=tag:Name,Values=*private-rt*" --query "RouteTables[*].RouteTableId" --output text
        $routeTableIds = $privateRouteTables -split "`t" | Where-Object { $_ }
        
        if ($routeTableIds.Count -gt $i) {
            $routeTableId = $routeTableIds[$i]
            aws ec2 create-route --route-table-id $routeTableId --destination-cidr-block "0.0.0.0/0" --nat-gateway-id $natId --region $Region | Out-Null
            Write-Host "    Updated route table: $routeTableId" -ForegroundColor Gray
        }
        
        Write-Host "    ✅ NAT Gateway $($i + 1) created" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ NAT Gateways recreated successfully!" -ForegroundColor Green
    Write-Host "   Note: NAT Gateways take 2-5 minutes to become available" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Tip: Use Terraform for better infrastructure management:" -ForegroundColor Cyan
    Write-Host "   cd infra/terraform && terraform apply -target=aws_nat_gateway.main" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Wait 2-5 minutes for NAT Gateways to become available" -ForegroundColor Gray
Write-Host "2. Verify NAT Gateway status:" -ForegroundColor Gray
Write-Host "   aws ec2 describe-nat-gateways --region $Region --filter 'Name=state,Values=available'" -ForegroundColor DarkGray
Write-Host "3. Start services:" -ForegroundColor Gray
Write-Host "   scripts/start-all-services.ps1" -ForegroundColor DarkGray

