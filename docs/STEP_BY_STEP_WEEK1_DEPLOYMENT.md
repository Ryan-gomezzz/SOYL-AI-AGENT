# Week 1 Deployment - Step-by-Step Guide

This guide provides detailed step-by-step instructions for completing the remaining Week 1 deployment tasks.

**Estimated Total Time:** ~40 minutes

---

## Prerequisites

✅ AWS CLI installed and configured  
✅ Docker installed and running  
✅ Terraform infrastructure deployed  
✅ Node.js installed (for running migrations locally, if needed)

---

## Task 1: SES DNS Record (5 minutes)

### Overview
Add a DNS TXT record to verify your domain with AWS SES for email sending.

### Step-by-Step Instructions

#### Step 1: Get the DNS Record Details
The DNS record details are already in your Terraform output:

```powershell
# From your terraform output:
# Name: _amazonses.www.soyl.cloud
# Type: TXT
# Value: sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=
```

#### Step 2: Add DNS Record (Choose Your DNS Provider)

**Option A: AWS Route 53**
1. Go to [AWS Console → Route 53 → Hosted Zones](https://console.aws.amazon.com/route53/v2/hostedzones)
2. Select your domain: `soyl.cloud`
3. Click **Create Record**
4. Configure:
   - **Record name:** `_amazonses.www`
   - **Record type:** `TXT`
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** 3600
5. Click **Create Records**

**Option B: Cloudflare**
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain: `soyl.cloud`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type:** `TXT`
   - **Name:** `_amazonses.www`
   - **Content:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** Auto
6. Click **Save**

**Option C: Other DNS Providers**
1. Log in to your DNS provider's control panel
2. Navigate to DNS Management / DNS Settings
3. Add a new TXT record:
   - **Host/Name:** `_amazonses.www` (or `_amazonses.www.soyl.cloud` - check your provider's format)
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** 3600
4. Save the record

#### Step 3: Verify DNS Record (Wait 5-15 minutes)

After adding the record, wait 5-15 minutes for DNS propagation, then verify:

```powershell
# Windows PowerShell
nslookup -type=TXT _amazonses.www.soyl.cloud

# Linux/Mac
dig TXT _amazonses.www.soyl.cloud
```

You should see the value: `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`

#### Step 4: Check SES Verification Status

```powershell
aws ses get-identity-verification-attributes --identities www.soyl.cloud --region us-east-1
```

The domain should show as `"VerificationStatus": "Success"` once DNS propagates.

**✅ Task 1 Complete!** SES domain is verified and ready to send emails.

---

## Task 2: Run Migrations (1 minute)

### Overview
Execute database migrations to create the `leads` table in your RDS PostgreSQL database.

### Step-by-Step Instructions

#### Option A: Run Migrations via ECS Task (Recommended for Production)

**Step 1: Create Migration Task Definition**

```powershell
# Get your ECR image and secrets
$ECR_IMAGE = "381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest"
$SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$CLUSTER = "ai-ca-agent-staging-cluster"
$SUBNET = "subnet-03753c781e88ba0f4"  # Use a private subnet ID
$SG = "sg-061bed860d1a0a4e3"  # ECS security group

# Run migration task
aws ecs run-task `
    --cluster $CLUSTER `
    --task-definition ai-ca-agent-staging-backend `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNET],securityGroups=[$SG],assignPublicIp=DISABLED}" `
    --overrides "{
        \"containerOverrides\": [{
            \"name\": \"backend\",
            \"command\": [\"node\", \"src/utils/migrate.js\", \"run\"],
            \"environment\": [{
                \"name\": \"RUN_MIGRATIONS\", \"value\": \"true\"
            }, {
                \"name\": \"DB_SECRET_ARN\", \"value\": \"$SECRET_ARN\"
            }]
        }]
    }" `
    --region us-east-1
```

**Step 2: Check Migration Status**

```powershell
# Get task ID from output, then check logs
aws logs tail /ecs/ai-ca-agent-staging --follow --region us-east-1
```

#### Option B: Run Migrations Locally (Development/Testing)

**Step 1: Set Environment Variables**

```powershell
# Get RDS credentials from Secrets Manager
$secret = aws secretsmanager get-secret-value --secret-id arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX --region us-east-1 | ConvertFrom-Json
$creds = $secret.SecretString | ConvertFrom-Json

# Set environment variables
$env:DB_HOST = $creds.host
$env:DB_PORT = "5432"
$env:DB_NAME = $creds.dbname
$env:DB_USER = $creds.username
$env:DB_PASSWORD = $creds.password
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$env:AWS_REGION = "us-east-1"
```

**Step 2: Run Migrations**

```powershell
cd services/backend
node src/utils/migrate.js run
```

**Step 3: Verify Migration Status**

```powershell
# Check which migrations have been run
node src/utils/migrate.js status
```

You should see:
```
✅ Executed | 001_create_leads_table.sql
```

**✅ Task 2 Complete!** Database schema is ready.

---

## Task 3: Deploy to ECS (5 minutes)

### Overview
Build, tag, and push your Docker images to ECR, then update your ECS services to use the new images.

### Step-by-Step Instructions

#### Step 1: Authenticate Docker to ECR

```powershell
$password = aws ecr get-login-password --region us-east-1
$password | docker login --username AWS --password-stdin 381492072674.dkr.ecr.us-east-1.amazonaws.com
```

Expected output: `Login Succeeded`

#### Step 2: Build Backend Docker Image

```powershell
# Navigate to project root
cd "C:\SOYL pvt Limited\Agents\SOYL-AI-AGENT"

# Build backend image
docker build -t ai-ca-agent-staging-backend:latest -f services/backend/Dockerfile services/backend
```

This may take 2-3 minutes on first build.

#### Step 3: Tag Backend Image for ECR

```powershell
docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
```

#### Step 4: Push Backend Image to ECR

```powershell
docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
```

This may take 1-2 minutes depending on image size.

#### Step 5: Update ECS Backend Service

```powershell
aws ecs update-service `
    --cluster ai-ca-agent-staging-cluster `
    --service ai-ca-agent-staging-backend-service `
    --force-new-deployment `
    --region us-east-1 `
    --no-cli-pager
```

Expected output: Service update initiated with new deployment.

#### Step 6: Wait for Service to Stabilize (Optional)

```powershell
aws ecs wait services-stable `
    --cluster ai-ca-agent-staging-cluster `
    --services ai-ca-agent-staging-backend-service `
    --region us-east-1
```

This waits for the new deployment to complete (2-3 minutes).

#### Step 7: Verify Deployment

```powershell
# Check service status
aws ecs describe-services `
    --cluster ai-ca-agent-staging-cluster `
    --services ai-ca-agent-staging-backend-service `
    --region us-east-1 `
    --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount,Deployments:deployments}' `
    --output json
```

You should see `"runningCount"` matching `"desiredCount"` (typically 1).

**✅ Task 3 Complete!** Backend service is deployed to ECS.

**Alternative: Use Deployment Script**

If you prefer, use the automated deployment script:

```powershell
.\scripts\deploy-backend.ps1
```

---

## Task 4: Test End-to-End (15-30 minutes)

### Overview
Test the complete flow: form submission → database save → email sending → API retrieval.

### Step-by-Step Instructions

#### Step 1: Get API Gateway URL

```powershell
$API_URL = "https://px9q707kr6.execute-api.us-east-1.amazonaws.com"
Write-Host "API URL: $API_URL"
```

#### Step 2: Test Health Check Endpoint

```powershell
# Test health check
Invoke-RestMethod -Uri "$API_URL/health" -Method GET
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "service": "backend",
  "environment": "production",
  "database": "connected"
}
```

#### Step 3: Test Enquiry Endpoint (Create Lead)

```powershell
# Test POST /api/v1/enquiry
$body = @{
    name = "Test User"
    email = "test@example.com"
    phone = "+1234567890"
    enquiry_type = "General Inquiry"
    notes = "This is a test enquiry"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$API_URL/api/v1/enquiry" -Method POST -Body $body -ContentType "application/json"
Write-Host "Lead ID: $($response.lead_id)"
Write-Host "Message: $($response.message)"
```

Expected response:
```json
{
  "lead_id": "uuid-here",
  "message": "Received"
}
```

**✅ Verify:**
1. Check that a confirmation email was sent (check your email inbox)
2. Verify the lead was saved to the database (next step)

#### Step 4: Test Leads Endpoint (Retrieve Lead)

```powershell
# Get the lead_id from Step 3
$LEAD_ID = "paste-lead-id-here"

# Test GET /api/v1/leads/:id
$lead = Invoke-RestMethod -Uri "$API_URL/api/v1/leads/$LEAD_ID" -Method GET
Write-Host ($lead | ConvertTo-Json -Depth 10)
```

Expected response:
```json
{
  "lead": {
    "id": "uuid-here",
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+1234567890",
    "enquiry_type": "General Inquiry",
    "notes": "This is a test enquiry",
    "source": "website",
    "status": "pending",
    "created_at": "2024-...",
    "updated_at": "2024-..."
  }
}
```

#### Step 5: Test Leads List Endpoint

```powershell
# Test GET /api/v1/leads (list all leads)
$leads = Invoke-RestMethod -Uri "$API_URL/api/v1/leads" -Method GET
Write-Host "Total leads: $($leads.pagination.total)"
Write-Host ($leads.leads | ConvertTo-Json -Depth 5)
```

Expected response:
```json
{
  "leads": [
    {
      "id": "uuid-here",
      "name": "Test User",
      "email": "test@example.com",
      "status": "pending",
      "created_at": "2024-..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

#### Step 6: Test Pagination

```powershell
# Test pagination with page and limit
$leads = Invoke-RestMethod -Uri "$API_URL/api/v1/leads?page=1&limit=10" -Method GET
Write-Host "Page: $($leads.pagination.page)"
Write-Host "Limit: $($leads.pagination.limit)"
Write-Host "Total: $($leads.pagination.total)"
```

#### Step 7: Test Filtering

```powershell
# Test filtering by status
$leads = Invoke-RestMethod -Uri "$API_URL/api/v1/leads?status=pending" -Method GET

# Test filtering by source
$leads = Invoke-RestMethod -Uri "$API_URL/api/v1/leads?source=website" -Method GET

# Test search
$leads = Invoke-RestMethod -Uri "$API_URL/api/v1/leads?search=Test" -Method GET
```

#### Step 8: Test Error Handling

```powershell
# Test invalid email (should return 400)
try {
    $badBody = @{
        name = "Test"
        email = "invalid-email"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "$API_URL/api/v1/enquiry" -Method POST -Body $badBody -ContentType "application/json"
} catch {
    Write-Host "Expected error caught: $($_.Exception.Message)"
}

# Test duplicate email (should return 409)
# Run the enquiry endpoint twice with the same email
```

#### Step 9: Verify Database Directly (Optional)

```powershell
# Connect to RDS and verify data
# You'll need to set up a database client or use AWS RDS Query Editor
# Or use psql if you have a bastion host configured
```

#### Step 10: Check ECS Logs

```powershell
# View recent logs
aws logs tail /ecs/ai-ca-agent-staging --since 30m --region us-east-1

# Follow logs in real-time
aws logs tail /ecs/ai-ca-agent-staging --follow --region us-east-1
```

**✅ Task 4 Complete!** End-to-end flow is working.

---

## Task 5: Run Benchmarks (10 minutes)

### Overview
Create and run a latency benchmark script to measure Ollama inference performance.

**Note:** This requires the LLM service to be implemented first. If not yet implemented, skip this task for now.

### Step-by-Step Instructions

#### Step 1: Get EC2 Instance IP

```powershell
# Get EC2 private IP
$INSTANCE_ID = "i-0548f3187e7f87967"
$instance = aws ec2 describe-instances --instance-ids $INSTANCE_ID --region us-east-1 --query 'Reservations[0].Instances[0]' | ConvertFrom-Json

Write-Host "EC2 Private IP: $($instance.PrivateIpAddress)"
Write-Host "EC2 Public IP: $($instance.PublicIpAddress)"
```

#### Step 2: Verify Ollama is Running

```powershell
# Test Ollama API (if EC2 has public IP or you're in the VPC)
$OLLAMA_URL = "http://$($instance.PrivateIpAddress):11434/api/tags"
Invoke-RestMethod -Uri $OLLAMA_URL -Method GET
```

#### Step 3: Create Benchmark Script

Create `services/backend/scripts/benchmark-llm.js`:

```javascript
/**
 * LLM Latency Benchmark Script
 * Measures Ollama inference latency with different prompt sizes
 */

const http = require('http');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const ITERATIONS = parseInt(process.env.ITERATIONS || '10', 10);

const testPrompts = [
    { name: 'Small', text: 'What is 2+2?', expectedSize: '~10 tokens' },
    { name: 'Medium', text: 'Summarize the following text: ' + 'Lorem ipsum dolor sit amet. '.repeat(20), expectedSize: '~100 tokens' },
    { name: 'Large', text: 'Analyze this text: ' + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100), expectedSize: '~500 tokens' }
];

async function makeRequest(prompt) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const data = JSON.stringify({
            model: MODEL,
            prompt: prompt,
            stream: false
        });

        const options = {
            hostname: new URL(OLLAMA_URL).hostname,
            port: new URL(OLLAMA_URL).port || 11434,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                const endTime = Date.now();
                const latency = endTime - startTime;
                try {
                    const result = JSON.parse(body);
                    resolve({ latency, success: true, response: result });
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${e.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(data);
        req.end();
    });
}

function calculateStats(latencies) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { avg, p50, p95, p99, min: sorted[0], max: sorted[sorted.length - 1] };
}

async function runBenchmark(promptConfig) {
    console.log(`\n📊 Benchmarking ${promptConfig.name} prompt (${promptConfig.expectedSize})...`);
    console.log('─'.repeat(60));

    const latencies = [];
    const errors = [];

    for (let i = 0; i < ITERATIONS; i++) {
        try {
            const result = await makeRequest(promptConfig.text);
            latencies.push(result.latency);
            process.stdout.write(`\r  Progress: ${i + 1}/${ITERATIONS} (${result.latency}ms)`);
        } catch (error) {
            errors.push(error.message);
            console.error(`\n  ❌ Error on iteration ${i + 1}: ${error.message}`);
        }
    }

    console.log('\n');

    if (latencies.length === 0) {
        console.log('❌ All requests failed. Cannot calculate statistics.');
        return null;
    }

    const stats = calculateStats(latencies);
    console.log(`  ✅ Successful requests: ${latencies.length}/${ITERATIONS}`);
    console.log(`  ⏱️  Average latency: ${stats.avg.toFixed(2)}ms`);
    console.log(`  📈 P50 latency: ${stats.p50.toFixed(2)}ms`);
    console.log(`  📈 P95 latency: ${stats.p95.toFixed(2)}ms`);
    console.log(`  📈 P99 latency: ${stats.p99.toFixed(2)}ms`);
    console.log(`  ⚡ Min latency: ${stats.min.toFixed(2)}ms`);
    console.log(`  🐌 Max latency: ${stats.max.toFixed(2)}ms`);

    if (errors.length > 0) {
        console.log(`  ⚠️  Errors: ${errors.length}`);
    }

    return stats;
}

async function main() {
    console.log('🚀 LLM Latency Benchmark');
    console.log('─'.repeat(60));
    console.log(`Ollama URL: ${OLLAMA_URL}`);
    console.log(`Model: ${MODEL}`);
    console.log(`Iterations per test: ${ITERATIONS}`);
    console.log(`Total tests: ${testPrompts.length}`);

    const results = {};

    for (const promptConfig of testPrompts) {
        const stats = await runBenchmark(promptConfig);
        if (stats) {
            results[promptConfig.name] = stats;
        }
        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n📊 Benchmark Summary');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(results, null, 2));

    // Save results to file
    const fs = require('fs');
    const resultsFile = `docs/LLM_BENCHMARK_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${resultsFile}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    });
}

module.exports = { runBenchmark, makeRequest };
```

#### Step 4: Run Benchmark Script

```powershell
# Set environment variables
$env:OLLAMA_URL = "http://<EC2_PRIVATE_IP>:11434"
$env:OLLAMA_MODEL = "llama3.2"  # or whatever model is installed
$env:ITERATIONS = "10"

# Run benchmark
cd services/backend
node scripts/benchmark-llm.js
```

#### Step 5: Review Results

The script will output:
- Average latency
- P50, P95, P99 percentiles
- Min/Max latency
- Success rate

Results are also saved to `docs/LLM_BENCHMARK_YYYY-MM-DD.json`.

#### Step 6: Document Results

Create `docs/LLM_BENCHMARK.md` with your results:

```markdown
# LLM Latency Benchmark Results

**Date:** 2024-XX-XX  
**Model:** llama3.2  
**Ollama URL:** http://<EC2_IP>:11434  
**Iterations per test:** 10

## Results

### Small Prompt (~10 tokens)
- Average: XXX ms
- P95: XXX ms
- P99: XXX ms

### Medium Prompt (~100 tokens)
- Average: XXX ms
- P95: XXX ms
- P99: XXX ms

### Large Prompt (~500 tokens)
- Average: XXX ms
- P95: XXX ms
- P99: XXX ms
```

**✅ Task 5 Complete!** Benchmarks documented.

---

## Quick Reference Commands

### SES DNS Record
```powershell
# Verify DNS record
nslookup -type=TXT _amazonses.www.soyl.cloud

# Check SES status
aws ses get-identity-verification-attributes --identities www.soyl.cloud --region us-east-1
```

### Migrations
```powershell
# Run migrations (local)
cd services/backend
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
node src/utils/migrate.js run

# Check migration status
node src/utils/migrate.js status
```

### ECS Deployment
```powershell
# Quick deploy script
.\scripts\deploy-backend.ps1

# Or manual steps:
$password = aws ecr get-login-password --region us-east-1
$password | docker login --username AWS --password-stdin 381492072674.dkr.ecr.us-east-1.amazonaws.com
docker build -t ai-ca-agent-staging-backend:latest -f services/backend/Dockerfile services/backend
docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
aws ecs update-service --cluster ai-ca-agent-staging-cluster --service ai-ca-agent-staging-backend-service --force-new-deployment --region us-east-1
```

### Testing
```powershell
# Health check
Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/health"

# Create lead
$body = @{name="Test";email="test@example.com";phone="+1234567890"} | ConvertTo-Json
Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/enquiry" -Method POST -Body $body -ContentType "application/json"

# Get leads
Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/leads"
```

### Logs
```powershell
# View logs
aws logs tail /ecs/ai-ca-agent-staging --since 30m --region us-east-1

# Follow logs
aws logs tail /ecs/ai-ca-agent-staging --follow --region us-east-1
```

---

## Troubleshooting

### SES DNS Issues
- **DNS not propagating:** Wait up to 48 hours (usually 15-30 minutes)
- **Wrong record value:** Double-check the exact value from Terraform output
- **Verification failing:** Ensure record name is exactly `_amazonses.www.soyl.cloud`

### Migration Issues
- **Connection failed:** Verify DB_SECRET_ARN is correct and RDS is accessible
- **Migration already run:** Check migration status with `node src/utils/migrate.js status`

### Deployment Issues
- **Docker build fails:** Check Dockerfile and dependencies
- **ECR push fails:** Verify ECR authentication (run login command again)
- **ECS service not updating:** Check service status in AWS Console

### Testing Issues
- **API returns 502:** Check ECS service health and logs
- **Database connection errors:** Verify RDS security group allows ECS connections
- **Email not sending:** Check SES domain verification status

---

## Next Steps

After completing all tasks:

1. ✅ Verify all Week 1 deliverables are working
2. ✅ Document any issues or findings
3. ✅ Proceed with remaining Week 1 tasks (Frontend Dashboard, LLM Service)
4. ✅ Schedule integration testing with the team

---

**Total Estimated Time:** ~40 minutes  
**Status:** Ready to execute 🚀

