# Terraform Automation Script
# This script runs the complete Terraform workflow

param(
    [switch]$SkipInstall,
    [switch]$Apply,
    [switch]$Destroy
)

$ErrorActionPreference = "Stop"
$TerraformVersion = "1.6.6"
$TerraformUrl = "https://releases.hashicorp.com/terraform/${TerraformVersion}/terraform_${TerraformVersion}_windows_amd64.zip"
$TerraformDir = "$env:LOCALAPPDATA\terraform"
$TerraformExe = "$TerraformDir\terraform.exe"

Write-Host "=== Terraform Automation Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check/Install Terraform
function Install-Terraform {
    Write-Host "Step 1: Checking Terraform installation..." -ForegroundColor Yellow
    
    # Check if terraform is in PATH
    $terraformInPath = Get-Command terraform -ErrorAction SilentlyContinue
    if ($terraformInPath) {
        Write-Host "✓ Terraform found: $($terraformInPath.Source)" -ForegroundColor Green
        terraform version
        return $true
    }
    
    # Check if terraform exists in local app data
    if (Test-Path $TerraformExe) {
        Write-Host "✓ Terraform found: $TerraformExe" -ForegroundColor Green
        & $TerraformExe version
        $env:PATH += ";$TerraformDir"
        return $true
    }
    
    if ($SkipInstall) {
        Write-Host "✗ Terraform not found and -SkipInstall specified" -ForegroundColor Red
        Write-Host "Please install Terraform manually from: https://www.terraform.io/downloads" -ForegroundColor Yellow
        return $false
    }
    
    Write-Host "Terraform not found. Attempting to install..." -ForegroundColor Yellow
    
    try {
        # Create directory
        New-Item -ItemType Directory -Force -Path $TerraformDir | Out-Null
        
        # Download Terraform
        Write-Host "Downloading Terraform ${TerraformVersion}..." -ForegroundColor Yellow
        $zipPath = "$env:TEMP\terraform.zip"
        Invoke-WebRequest -Uri $TerraformUrl -OutFile $zipPath -UseBasicParsing
        
        # Extract
        Write-Host "Extracting Terraform..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath $TerraformDir -Force
        
        # Cleanup
        Remove-Item $zipPath -Force
        
        # Add to PATH for this session
        $env:PATH += ";$TerraformDir"
        
        Write-Host "✓ Terraform installed successfully!" -ForegroundColor Green
        & $TerraformExe version
        return $true
    }
    catch {
        Write-Host "✗ Failed to install Terraform: $_" -ForegroundColor Red
        Write-Host "Please install manually from: https://www.terraform.io/downloads" -ForegroundColor Yellow
        return $false
    }
}

# Step 2: Verify AWS credentials
function Test-AWSCredentials {
    Write-Host ""
    Write-Host "Step 2: Verifying AWS credentials..." -ForegroundColor Yellow
    
    try {
        $identity = aws sts get-caller-identity 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ AWS credentials valid" -ForegroundColor Green
            Write-Host $identity
            return $true
        }
        else {
            Write-Host "✗ AWS credentials not configured" -ForegroundColor Red
            Write-Host "Run: aws configure" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "✗ Error checking AWS credentials: $_" -ForegroundColor Red
        return $false
    }
}

# Step 3: Verify SSH key
function Test-SSHKey {
    Write-Host ""
    Write-Host "Step 3: Verifying EC2 keypair..." -ForegroundColor Yellow
    
    $tfvarsPath = "infra\terraform\terraform.tfvars"
    if (-not (Test-Path $tfvarsPath)) {
        Write-Host "✗ terraform.tfvars not found" -ForegroundColor Red
        return $false
    }
    
    $tfvars = Get-Content $tfvarsPath -Raw
    if ($tfvars -match 'ssh_key_name\s*=\s*"([^"]+)"') {
        $keyName = $matches[1]
        Write-Host "Keypair name in tfvars: $keyName" -ForegroundColor Cyan
        
        try {
            $keys = aws ec2 describe-key-pairs --region us-east-1 --query "KeyPairs[?KeyName=='$keyName']" 2>&1
            if ($keys -and $keys -ne "[]") {
                Write-Host "✓ Keypair '$keyName' exists in us-east-1" -ForegroundColor Green
                return $true
            }
            else {
                Write-Host "⚠ Keypair '$keyName' not found in us-east-1" -ForegroundColor Yellow
                Write-Host "Please verify the keypair exists or update terraform.tfvars" -ForegroundColor Yellow
                return $true  # Continue anyway, might be in different region
            }
        }
        catch {
            Write-Host "⚠ Could not verify keypair (continuing anyway)" -ForegroundColor Yellow
            return $true
        }
    }
    else {
        Write-Host "⚠ Could not parse ssh_key_name from tfvars" -ForegroundColor Yellow
        return $true
    }
}

# Step 4: Run Terraform commands
function Run-Terraform {
    param([string]$Command, [string[]]$Arguments)
    
    $terraformCmd = if (Get-Command terraform -ErrorAction SilentlyContinue) { "terraform" } else { $TerraformExe }
    
    Push-Location "infra\terraform"
    try {
        Write-Host ""
        Write-Host "Running: $terraformCmd $Command $($Arguments -join ' ')" -ForegroundColor Cyan
        & $terraformCmd $Command $Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Terraform command failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

# Main execution
try {
    # Install Terraform
    if (-not (Install-Terraform)) {
        Write-Host ""
        Write-Host "Cannot proceed without Terraform. Exiting." -ForegroundColor Red
        exit 1
    }
    
    # Verify AWS
    if (-not (Test-AWSCredentials)) {
        Write-Host ""
        Write-Host "Cannot proceed without AWS credentials. Exiting." -ForegroundColor Red
        exit 1
    }
    
    # Verify SSH key
    Test-SSHKey | Out-Null
    
    # Initialize
    Write-Host ""
    Write-Host "Step 4: Initializing Terraform..." -ForegroundColor Yellow
    Run-Terraform "init" @("-input=false")
    
    # Validate
    Write-Host ""
    Write-Host "Step 5: Validating Terraform configuration..." -ForegroundColor Yellow
    Run-Terraform "validate"
    
    # Plan
    Write-Host ""
    Write-Host "Step 6: Generating Terraform plan..." -ForegroundColor Yellow
    Run-Terraform "plan" @("-out=tfplan")
    
    # Save plan
    Write-Host ""
    Write-Host "Step 7: Saving plan outputs..." -ForegroundColor Yellow
    Push-Location "infra\terraform"
    try {
        New-Item -ItemType Directory -Force -Path "plans" | Out-Null
        $terraformCmd = if (Get-Command terraform -ErrorAction SilentlyContinue) { "terraform" } else { $TerraformExe }
        & $terraformCmd show -no-color tfplan | Out-File -FilePath "plans\week1_plan.txt" -Encoding utf8
        & $terraformCmd show -json tfplan | Out-File -FilePath "plans\week1_plan.json" -Encoding utf8
        Write-Host "✓ Plan saved to plans/week1_plan.txt" -ForegroundColor Green
        Write-Host "✓ Plan saved to plans/week1_plan.json" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
    
    # Show plan summary
    Write-Host ""
    Write-Host "=== Plan Summary ===" -ForegroundColor Cyan
    Push-Location "infra\terraform"
    try {
        $planOutput = & $terraformCmd show tfplan
        $planOutput | Select-String -Pattern "Plan:|to add|to change|to destroy" | ForEach-Object {
            Write-Host $_ -ForegroundColor Yellow
        }
    }
    finally {
        Pop-Location
    }
    
    # Apply or prompt
    if ($Destroy) {
        Write-Host ""
        Write-Host "⚠ DESTROY MODE: This will DELETE all infrastructure!" -ForegroundColor Red
        $confirm = Read-Host "Type 'yes' to confirm destruction"
        if ($confirm -eq "yes") {
            Write-Host "Destroying infrastructure..." -ForegroundColor Yellow
            Run-Terraform "destroy" @("-auto-approve")
        }
        else {
            Write-Host "Destroy cancelled." -ForegroundColor Green
        }
    }
    elseif ($Apply) {
        Write-Host ""
        Write-Host "⚠ APPLY MODE: This will CREATE AWS resources and incur costs!" -ForegroundColor Red
        Write-Host "Estimated monthly cost: ~$200-500" -ForegroundColor Yellow
        $confirm = Read-Host "Type 'yes' to apply changes"
        if ($confirm -eq "yes") {
            Write-Host ""
            Write-Host "Applying infrastructure..." -ForegroundColor Yellow
            Run-Terraform "apply" @("tfplan")
            
            # Save outputs
            Write-Host ""
            Write-Host "Saving outputs..." -ForegroundColor Yellow
            Push-Location "infra\terraform"
            try {
                & $terraformCmd output -json | Out-File -FilePath "plans\week1_outputs.json" -Encoding utf8
                Write-Host "✓ Outputs saved to plans/week1_outputs.json" -ForegroundColor Green
                Write-Host ""
                Write-Host "=== Terraform Outputs ===" -ForegroundColor Cyan
                & $terraformCmd output
            }
            finally {
                Pop-Location
            }
        }
        else {
            Write-Host "Apply cancelled. Review the plan and run again with -Apply when ready." -ForegroundColor Yellow
        }
    }
    else {
        Write-Host ""
        Write-Host "=== Next Steps ===" -ForegroundColor Cyan
        Write-Host "1. Review the plan: infra\terraform\plans\week1_plan.txt" -ForegroundColor White
        Write-Host "2. Add SES DNS records (see plan output for verification token)" -ForegroundColor White
        Write-Host "3. When ready, run this script with -Apply flag:" -ForegroundColor White
        Write-Host "   .\scripts\run-terraform.ps1 -Apply" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠ IMPORTANT: Do not apply without reviewing the plan and adding SES DNS records!" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "=== Complete ===" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "✗ Error: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
}

