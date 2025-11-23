# Week 1 Deployment Checklist

Quick checklist for completing Week 1 deployment tasks.

**Total Estimated Time:** ~40 minutes

---

## ✅ Task 1: SES DNS Record (5 minutes)

- [ ] Get DNS record details from Terraform output
  - Name: `_amazonses.www.soyl.cloud`
  - Type: `TXT`
  - Value: `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`

- [ ] Add TXT record to DNS provider
  - [ ] Route 53
  - [ ] Cloudflare
  - [ ] Other DNS provider

- [ ] Wait 5-15 minutes for DNS propagation

- [ ] Verify DNS record:
  ```powershell
  nslookup -type=TXT _amazonses.www.soyl.cloud
  ```

- [ ] Check SES verification status:
  ```powershell
  aws ses get-identity-verification-attributes --identities www.soyl.cloud --region us-east-1
  ```

**✅ Complete when:** SES domain shows as "Success" verified

---

## ✅ Task 2: Run Migrations (1 minute)

### Option A: Local (Development)

- [ ] Set environment variables:
  ```powershell
  $env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
  $env:AWS_REGION = "us-east-1"
  ```

- [ ] Run migrations:
  ```powershell
  cd services/backend
  node src/utils/migrate.js run
  ```

- [ ] Verify migration status:
  ```powershell
  node src/utils/migrate.js status
  ```

### Option B: ECS Task (Production)

- [ ] Run migration via ECS task (see full guide)

**✅ Complete when:** Migration shows `001_create_leads_table.sql` as executed

---

## ✅ Task 3: Deploy to ECS (5 minutes)

- [ ] Authenticate Docker to ECR:
  ```powershell
  $password = aws ecr get-login-password --region us-east-1
  $password | docker login --username AWS --password-stdin 381492072674.dkr.ecr.us-east-1.amazonaws.com
  ```

- [ ] Build Docker image:
  ```powershell
  docker build -t ai-ca-agent-staging-backend:latest -f services/backend/Dockerfile services/backend
  ```

- [ ] Tag image for ECR:
  ```powershell
  docker tag ai-ca-agent-staging-backend:latest 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
  ```

- [ ] Push image to ECR:
  ```powershell
  docker push 381492072674.dkr.ecr.us-east-1.amazonaws.com/ai-ca-agent-staging/backend:latest
  ```

- [ ] Update ECS service:
  ```powershell
  aws ecs update-service --cluster ai-ca-agent-staging-cluster --service ai-ca-agent-staging-backend-service --force-new-deployment --region us-east-1
  ```

- [ ] Wait for service to stabilize (optional):
  ```powershell
  aws ecs wait services-stable --cluster ai-ca-agent-staging-cluster --services ai-ca-agent-staging-backend-service --region us-east-1
  ```

**OR use automated script:**
- [ ] Run deployment script:
  ```powershell
  .\scripts\deploy-backend.ps1
  ```

**✅ Complete when:** ECS service shows running tasks and healthy status

---

## ✅ Task 4: Test End-to-End (15-30 minutes)

- [ ] Test health check:
  ```powershell
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/health"
  ```
  **Expected:** `{"status": "ok", "database": "connected"}`

- [ ] Test enquiry endpoint (create lead):
  ```powershell
  $body = @{name="Test User";email="test@example.com";phone="+1234567890"} | ConvertTo-Json
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/enquiry" -Method POST -Body $body -ContentType "application/json"
  ```
  **Expected:** `{"lead_id": "<uuid>", "message": "Received"}`

- [ ] Check email inbox for confirmation email

- [ ] Test get lead by ID:
  ```powershell
  $LEAD_ID = "<paste-lead-id-from-step-above>"
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/leads/$LEAD_ID"
  ```
  **Expected:** Lead object with all details

- [ ] Test leads list endpoint:
  ```powershell
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/leads"
  ```
  **Expected:** Array of leads with pagination

- [ ] Test pagination:
  ```powershell
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/leads?page=1&limit=10"
  ```

- [ ] Test filtering:
  ```powershell
  Invoke-RestMethod -Uri "https://px9q707kr6.execute-api.us-east-1.amazonaws.com/api/v1/leads?status=pending"
  ```

- [ ] Test error handling (invalid email):
  ```powershell
  $badBody = @{name="Test";email="invalid-email"} | ConvertTo-Json
  # Should return 400 error
  ```

- [ ] Check ECS logs for any errors:
  ```powershell
  aws logs tail /ecs/ai-ca-agent-staging --since 30m --region us-east-1
  ```

**✅ Complete when:** All endpoints work correctly and email is sent

---

## ✅ Task 5: Run Benchmarks (10 minutes)

**Note:** Requires LLM service to be implemented first. Skip if not ready.

- [ ] Get EC2 instance IP:
  ```powershell
  $INSTANCE_ID = "i-0548f3187e7f87967"
  aws ec2 describe-instances --instance-ids $INSTANCE_ID --region us-east-1 --query 'Reservations[0].Instances[0].PrivateIpAddress'
  ```

- [ ] Verify Ollama is running:
  ```powershell
  $OLLAMA_URL = "http://<EC2_PRIVATE_IP>:11434"
  Invoke-RestMethod -Uri "$OLLAMA_URL/api/tags"
  ```

- [ ] Set environment variables:
  ```powershell
  $env:OLLAMA_URL = "http://<EC2_PRIVATE_IP>:11434"
  $env:OLLAMA_MODEL = "llama3.2"
  $env:ITERATIONS = "10"
  ```

- [ ] Run benchmark:
  ```powershell
  cd services/backend
  node scripts/benchmark-llm.js
  ```

- [ ] Review results:
  - Average latency
  - P95, P99 percentiles
  - Min/Max latency
  - Success rate

- [ ] Check results file:
  - `docs/LLM_BENCHMARK_YYYY-MM-DD.json`

- [ ] Document results in `docs/LLM_BENCHMARK.md`

**✅ Complete when:** Benchmark results are documented

---

## 🎯 Final Verification

- [ ] All tasks completed
- [ ] API endpoints working
- [ ] Database migrations applied
- [ ] Email sending working
- [ ] ECS service healthy
- [ ] Logs show no errors

---

## 📝 Quick Commands Reference

### SES
```powershell
nslookup -type=TXT _amazonses.www.soyl.cloud
aws ses get-identity-verification-attributes --identities www.soyl.cloud --region us-east-1
```

### Migrations
```powershell
cd services/backend
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
node src/utils/migrate.js run
node src/utils/migrate.js status
```

### Deployment
```powershell
.\scripts\deploy-backend.ps1
```

### Testing
```powershell
$API = "https://px9q707kr6.execute-api.us-east-1.amazonaws.com"
Invoke-RestMethod -Uri "$API/health"
Invoke-RestMethod -Uri "$API/api/v1/leads"
```

### Logs
```powershell
aws logs tail /ecs/ai-ca-agent-staging --follow --region us-east-1
```

---

**Status:** Ready to execute 🚀  
**See full guide:** `docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md`

