# Next Steps - Action Plan

## Current Status

✅ **Completed:**
- Backend API (all endpoints)
- Database migrations
- Email service
- Frontend Dashboard (just completed)
- Infrastructure deployed to AWS

## Recommended Next Steps (In Order)

### Phase 1: Test & Deploy Current Work (30-45 minutes)

#### 1. Test Frontend Locally (5 minutes)
```bash
cd frontend
npm install
npm run dev
```

**Action Items:**
- Verify frontend runs locally
- Test dashboard loads
- Test enquiry form submission
- Check API integration works

**Expected Result:** Frontend connects to backend API and displays data

---

#### 2. Deploy Backend to ECS (10 minutes)
Follow the deployment guide: `docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md`

**Quick Steps:**
```powershell
# Use the deployment script
.\scripts\deploy-backend.ps1

# OR follow manual steps from docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md
```

**Action Items:**
- Build Docker image
- Push to ECR
- Update ECS service
- Verify deployment

**Expected Result:** Backend running on ECS, accessible via API Gateway

---

#### 3. Run Database Migrations (1 minute)
```powershell
cd services/backend
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$env:AWS_REGION = "us-east-1"
node src/utils/migrate.js run
```

**Action Items:**
- Run migrations
- Verify `leads` table created

**Expected Result:** Database schema ready

---

#### 4. Add SES DNS Record (5 minutes)
Follow: `docs/SES_DNS_SETUP.md`

**Action Items:**
- Add TXT record: `_amazonses.www.soyl.cloud`
- Value: `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
- Wait 5-15 minutes for propagation
- Verify SES domain verification

**Expected Result:** SES verified, emails can be sent

---

#### 5. Test End-to-End (15-30 minutes)
Follow: `docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md` - Task 4

**Action Items:**
- Test health check endpoint
- Test enquiry endpoint (create lead)
- Verify email sent
- Test leads list endpoint
- Test dashboard with real data

**Expected Result:** Complete flow working end-to-end

---

### Phase 2: LLM Service Implementation (6-8 hours)

#### 6. Get EC2 Instance IP
```powershell
$INSTANCE_ID = "i-0548f3187e7f87967"
aws ec2 describe-instances --instance-ids $INSTANCE_ID --region us-east-1 --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text
```

**Action Items:**
- Get EC2 private IP
- Verify Ollama is running
- Check if model is installed

**Expected Result:** EC2 IP known, Ollama accessible

---

#### 7. Implement LLM Service
**Files to create:**
- `services/backend/src/services/llm.js` - Ollama client
- `services/backend/src/routes/llm.js` - Inference endpoints

**Action Items:**
- Create Ollama client service
- Implement inference endpoint `/api/v1/llm/infer`
- Add JSON schema validation
- Integrate with prompt templates
- Test with sample prompts

**Expected Result:** LLM inference endpoint working

---

#### 8. Run Latency Benchmarks (10 minutes)
```powershell
$env:OLLAMA_URL = "http://<EC2_IP>:11434"
$env:OLLAMA_MODEL = "llama3.2"
cd services/backend
node scripts/benchmark-llm.js
```

**Action Items:**
- Run benchmark script
- Test with different prompt sizes
- Document results

**Expected Result:** Benchmark results documented

---

## Quick Priority Guide

### Must Do Now (To Get Working System):
1. ✅ **Test Frontend Locally** (5 min)
2. ✅ **Deploy Backend to ECS** (10 min)
3. ✅ **Run Migrations** (1 min)
4. ✅ **Test End-to-End** (15 min)

**Total Time:** ~30 minutes

### Should Do Soon (For Email):
5. ✅ **Add SES DNS Record** (5 min + wait time)

### Can Do Later (For LLM Features):
6. ✅ **LLM Service** (6-8 hours)
7. ✅ **Benchmarks** (10 minutes)

---

## Immediate Next Step

**I recommend starting with:**

### 1. Test Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Then:
- Open `http://localhost:5173` (or the port Vite shows)
- Test the dashboard
- Test the enquiry form

**If frontend works:** Proceed to deploy backend to ECS

**If frontend has issues:** Fix them first before deploying

---

## Full Checklist

Use this checklist to track progress:

### Phase 1: Testing & Deployment
- [ ] Test frontend locally
- [ ] Deploy backend to ECS
- [ ] Run database migrations
- [ ] Add SES DNS record
- [ ] Test end-to-end flow
- [ ] Verify dashboard works with deployed backend

### Phase 2: LLM Service
- [ ] Get EC2 instance IP
- [ ] Verify Ollama is running
- [ ] Create LLM service (`services/llm.js`)
- [ ] Create LLM routes (`routes/llm.js`)
- [ ] Implement inference endpoint
- [ ] Test LLM endpoint
- [ ] Run latency benchmarks
- [ ] Document benchmark results

---

## Files to Reference

- **Deployment Guide:** `docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md`
- **Deployment Checklist:** `docs/WEEK1_DEPLOYMENT_CHECKLIST.md`
- **SES Setup:** `docs/SES_DNS_SETUP.md`
- **Status Update:** `docs/WEEK1_STATUS_UPDATE.md`
- **Frontend Complete:** `docs/FRONTEND_DASHBOARD_COMPLETE.md`

---

## Summary

**Right Now (Next 30 minutes):**
1. Test frontend locally
2. Deploy backend to ECS
3. Run migrations
4. Test end-to-end

**This Week:**
5. Add SES DNS record
6. Implement LLM service
7. Run benchmarks

---

**Recommended:** Start with testing the frontend locally to ensure everything works before deploying.

