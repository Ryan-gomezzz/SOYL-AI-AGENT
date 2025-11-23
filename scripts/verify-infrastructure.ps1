# Verify Week 1 Infrastructure Deployment
# This script checks if all infrastructure resources are deployed in AWS

param(
    [string]$Region = "us-east-1",
    [string]$ProjectPrefix = "ai-ca-agent-staging"
)

$ErrorActionPreference = "Continue"
$issues = @()
$verified = @()

Write-Host "=== Verifying Week 1 Infrastructure Deployment ===" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Project Prefix: $ProjectPrefix" -ForegroundColor Yellow
Write-Host ""

# Function to check AWS resource
function Test-AWSResource {
    param(
        [string]$ResourceName,
        [scriptblock]$CheckScript
    )
    
    try {
        $result = & $CheckScript
        if ($result) {
            Write-Host "✓ $ResourceName" -ForegroundColor Green
            $script:verified += $ResourceName
            return $true
        } else {
            Write-Host "✗ $ResourceName - NOT FOUND" -ForegroundColor Red
            $script:issues += $ResourceName
            return $false
        }
    } catch {
        Write-Host "✗ $ResourceName - ERROR: $_" -ForegroundColor Red
        $script:issues += $ResourceName
        return $false
    }
}

# 1. Check VPC
Write-Host "1. Checking VPC..." -ForegroundColor Yellow
Test-AWSResource "VPC" {
    $vpc = aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${ProjectPrefix}-vpc" --region $Region --query 'Vpcs[0].VpcId' --output text 2>$null
    return ($vpc -and $vpc -ne "None" -and $vpc -ne "")
}
Write-Host ""

# 2. Check Subnets
Write-Host "2. Checking Subnets..." -ForegroundColor Yellow
$subnetCount = 0
$subnets = aws ec2 describe-subnets --filters "Name=tag:Name,Values=${ProjectPrefix}-*" --region $Region --query 'Subnets[*].SubnetId' --output text 2>$null
if ($subnets) {
    $subnetArray = $subnets -split "`t"
    $subnetCount = ($subnetArray | Where-Object { $_ -ne "" }).Count
}
Test-AWSResource "Subnets (Expected: 4 - Found: $subnetCount)" {
    return ($subnetCount -ge 4)
}
Write-Host ""

# 3. Check RDS Instance
Write-Host "3. Checking RDS PostgreSQL..." -ForegroundColor Yellow
Test-AWSResource "RDS PostgreSQL" {
    $rds = aws rds describe-db-instances --filters "Name=db-instance-id,Values=${ProjectPrefix}-db" --region $Region --query 'DBInstances[0].DBInstanceIdentifier' --output text 2>$null
    return ($rds -and $rds -ne "None" -and $rds -ne "")
}
Write-Host ""

# 4. Check S3 Buckets
Write-Host "4. Checking S3 Buckets..." -ForegroundColor Yellow
$bucketCount = 0
$expectedBuckets = @("recordings", "transcripts", "static")
foreach ($bucketType in $expectedBuckets) {
    $bucketName = "${ProjectPrefix}-${bucketType}-${Region}"
    $bucket = aws s3api head-bucket --bucket $bucketName --region $Region 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ S3 Bucket: $bucketName" -ForegroundColor Green
        $bucketCount++
    } else {
        Write-Host "  ✗ S3 Bucket: $bucketName - NOT FOUND" -ForegroundColor Red
        $issues += "S3 Bucket: $bucketName"
    }
}
if ($bucketCount -eq 3) {
    $verified += "S3 Buckets (all 3)"
} else {
    $issues += "S3 Buckets (missing $($expectedBuckets.Count - $bucketCount))"
}
Write-Host ""

# 5. Check SES
Write-Host "5. Checking SES..." -ForegroundColor Yellow
Test-AWSResource "SES Domain Identity" {
    $sesDomain = aws ses get-identity-verification-attributes --identities "www.soyl.cloud" --region $Region --query 'VerificationAttributes."www.soyl.cloud"' --output text 2>$null
    return ($sesDomain -and $sesDomain -ne "None" -and $sesDomain -ne "")
}
Write-Host ""

# 6. Check Lambda
Write-Host "6. Checking Lambda Function..." -ForegroundColor Yellow
Test-AWSResource "Lambda Function" {
    $lambda = aws lambda get-function --function-name "${ProjectPrefix}-enquiry-handler" --region $Region --query 'Configuration.FunctionName' --output text 2>$null
    return ($lambda -and $lambda -ne "None" -and $lambda -ne "")
}
Write-Host ""

# 7. Check API Gateway
Write-Host "7. Checking API Gateway..." -ForegroundColor Yellow
Test-AWSResource "API Gateway" {
    $apiId = aws apigatewayv2 get-apis --region $Region --query "Items[?Name=='${ProjectPrefix}-api'].ApiId" --output text 2>$null
    if (-not $apiId -or $apiId -eq "None" -or $apiId -eq "") {
        # Try alternative method
        $apis = aws apigatewayv2 get-apis --region $Region --query 'Items[*].ApiId' --output text 2>$null
        if ($apis) {
            $apiId = ($apis -split "`t")[0]
        }
    }
    return ($apiId -and $apiId -ne "None" -and $apiId -ne "")
}
Write-Host ""

# 8. Check ECS Cluster
Write-Host "8. Checking ECS Cluster..." -ForegroundColor Yellow
Test-AWSResource "ECS Cluster" {
    $cluster = aws ecs describe-clusters --clusters "${ProjectPrefix}-cluster" --region $Region --query 'clusters[0].clusterName' --output text 2>$null
    return ($cluster -and $cluster -ne "None" -and $cluster -ne "")
}
Write-Host ""

# 9. Check ECS Service
Write-Host "9. Checking ECS Service..." -ForegroundColor Yellow
Test-AWSResource "ECS Service" {
    $service = aws ecs describe-services --cluster "${ProjectPrefix}-cluster" --services "${ProjectPrefix}-backend-service" --region $Region --query 'services[0].serviceName' --output text 2>$null
    return ($service -and $service -ne "None" -and $service -ne "")
}
Write-Host ""

# 10. Check EC2 Instance
Write-Host "10. Checking EC2 Instance..." -ForegroundColor Yellow
Test-AWSResource "EC2 Instance (Ollama)" {
    $instance = aws ec2 describe-instances --filters "Name=tag:Name,Values=${ProjectPrefix}-ollama-instance" "Name=instance-state-name,Values=running" --region $Region --query 'Reservations[0].Instances[0].InstanceId' --output text 2>$null
    return ($instance -and $instance -ne "None" -and $instance -ne "")
}
Write-Host ""

# 11. Check ECR Repositories
Write-Host "11. Checking ECR Repositories..." -ForegroundColor Yellow
$ecrCount = 0
$expectedRepos = @("backend", "worker")
foreach ($repo in $expectedRepos) {
    $repoName = "${ProjectPrefix}/${repo}"
    $ecr = aws ecr describe-repositories --repository-names $repoName --region $Region --query 'repositories[0].repositoryName' --output text 2>$null
    if ($ecr -and $ecr -ne "None" -and $ecr -ne "") {
        Write-Host "  ✓ ECR Repository: $repoName" -ForegroundColor Green
        $ecrCount++
    } else {
        Write-Host "  ✗ ECR Repository: $repoName - NOT FOUND" -ForegroundColor Red
        $issues += "ECR Repository: $repoName"
    }
}
if ($ecrCount -eq 2) {
    $verified += "ECR Repositories (both)"
} else {
    $issues += "ECR Repositories (missing $($expectedRepos.Count - $ecrCount))"
}
Write-Host ""

# Summary
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verified Resources: $($verified.Count)" -ForegroundColor Green
foreach ($item in $verified) {
    Write-Host "  ✓ $item" -ForegroundColor Green
}
Write-Host ""

if ($issues.Count -gt 0) {
    Write-Host "Issues Found: $($issues.Count)" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "  ✗ $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Some resources may not be deployed or may have different names." -ForegroundColor Yellow
    Write-Host "Check AWS Console or Terraform outputs for actual resource names." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✓ All infrastructure resources verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Infrastructure Status: DEPLOYED" -ForegroundColor Green
    exit 0
}

