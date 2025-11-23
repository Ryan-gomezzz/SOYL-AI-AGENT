# Week 1 Remaining Tasks - Detailed Analysis

**Reference:** `reference/README.md` -> WEEK 1 — FOUNDATIONS & CORE PIPELINE

## ✅ What's COMPLETE (Infrastructure)

### Engineer A Tasks ✅
- ✅ IAM, VPC, subnets - **DEPLOYED TO AWS**
- ✅ RDS Postgres - **DEPLOYED TO AWS** (db.t3.medium running)
- ✅ S3 buckets - **DEPLOYED TO AWS** (3 buckets created)
- ✅ SES - **DEPLOYED TO AWS** (domain identity created, DNS needs to be added)
- ✅ Lambda - **DEPLOYED TO AWS** (function created)
- ✅ API Gateway - **DEPLOYED TO AWS** (HTTP API created)
- ✅ ECS Fargate - **DEPLOYED TO AWS** (cluster and service running)
- ✅ Terraform skeleton - **COMPLETE**

### Engineer B Tasks (Partial)
- ✅ EC2 GPU configuration - **DEPLOYED TO AWS** (t2.micro instance running)
- ✅ Install Ollama - **Userdata script created** (will install on instance startup)
- ✅ Prompt templates - **Created** in `reference/prompt-templates.md`
- ❌ **LLM API** - **NOT IMPLEMENTED** (backend doesn't connect to Ollama)
- ❌ **Latency benchmark** - **NOT DONE**

### Engineer C Tasks (Partial)
- ✅ React + Tailwind lead form - **Created**
- ✅ API integration - **Frontend skeleton** (calls placeholder endpoint)
- ❌ **Minimal dashboard** - **NOT IMPLEMENTED** (no list view)

## ❌ What's MISSING (Functional Implementation)

### Critical Missing Items for Week 1 Deliverables

#### 1. Leads Stored in DB ❌
**Status:** Backend endpoint exists but is a placeholder
**What's needed:**
- Database connection code (connect to RDS using Secrets Manager)
- Database migrations/schema setup (leads table per reference/README.md)
- Implement `/api/v1/enquiry` endpoint to save leads to DB
- Return `lead_id` (UUID) as per API contract

**Files to create/modify:**
- `services/backend/src/db.js` - Database connection
- `services/backend/migrations/001_create_leads_table.sql` - Migration
- `services/backend/src/routes/enquiry.js` - Enquiry endpoint implementation
- Update `services/backend/src/index.js` to use real DB

**API Contract (from reference/README.md):**
```json
POST /enquiry
Request: { "name": "string", "email": "string", "phone": "string", "enquiry_type": "string", "notes": "optional string" }
Response: 201 { "lead_id": "<uuid>", "message": "Received" }
```

**Estimated Effort:** 4-6 hours

---

#### 2. Confirmation Emails ❌
**Status:** SES configured, email template exists, but no sending code
**What's needed:**
- Implement email sending service using AWS SES
- Integrate with backend to send email after lead is saved
- Use template from `services/backend/templates/confirmation_email.html`
- Send from verified email identity (ryangomez9965@gmail.com)

**Files to create/modify:**
- `services/backend/src/services/email.js` - SES email service
- Update `services/backend/src/routes/enquiry.js` to send email after saving lead

**Note:** SES domain DNS record needs to be added first (see `docs/SES_DNS_SETUP.md`)

**Estimated Effort:** 2-3 hours

---

#### 3. LLM Inference Endpoint ❌
**Status:** EC2 configured, Ollama will install via userdata, but no API endpoint
**What's needed:**
- Create LLM service in backend to connect to Ollama on EC2
- Implement inference endpoint (e.g., `/api/v1/llm/infer`)
- Connect to Ollama API (default port 11434)
- Use prompt templates from `reference/prompt-templates.md`
- Implement JSON schema validation using `reference/json-schemas/intent-extraction.schema.json`

**Files to create/modify:**
- `services/backend/src/services/llm.js` - Ollama client service
- `services/backend/src/routes/llm.js` - LLM inference endpoints
- Update `services/backend/src/index.js` to add LLM routes

**Ollama API Info:**
- EC2 Instance ID: `i-0548f3187e7f87967`
- Ollama runs on port 11434
- Model: Will be installed via userdata (likely llama3.2 or similar)
- Need to get EC2 private IP from AWS to connect

**Estimated Effort:** 6-8 hours

---

#### 4. Dashboard List View ❌
**Status:** Frontend form exists, but no dashboard/list view
**What's needed:**
- Create dashboard page with leads list
- Fetch leads from backend API
- Display lead information in table/cards
- Add routing (React Router)
- Style with Tailwind CSS

**Files to create/modify:**
- `frontend/src/pages/Dashboard.jsx` - Dashboard list view
- `frontend/src/pages/EnquiryForm.jsx` - Move form to separate page
- `frontend/src/App.jsx` - Add routing
- `frontend/src/api/leads.js` - API client for fetching leads
- Update backend to add `GET /api/v1/leads` endpoint

**Backend endpoint needed:**
```json
GET /api/v1/leads
Response: 200 [{ "lead_id": "uuid", "name": "string", "email": "string", "status": "string", "created_at": "timestamp" }]
```

**Estimated Effort:** 4-6 hours

---

#### 5. Latency Benchmark ❌
**Status:** Not done
**What's needed:**
- Create benchmark script/test
- Measure Ollama inference latency
- Document results (average, p95, p99)
- Test with different prompt sizes

**Files to create:**
- `services/backend/scripts/benchmark-llm.js` - Latency benchmark script
- `docs/LLM_BENCHMARK.md` - Benchmark results

**Estimated Effort:** 2-3 hours

---

## 📋 Complete Task Checklist

### Priority 1: Core Functionality (Must Have for Week 1)

- [ ] **Database Connection & Migrations**
  - [ ] Create `services/backend/src/db.js` with RDS connection using Secrets Manager
  - [ ] Create `services/backend/migrations/001_create_leads_table.sql`
  - [ ] Implement migration runner or use migration tool
  - [ ] Test database connection

- [ ] **Enquiry Endpoint Implementation**
  - [ ] Update `services/backend/src/index.js` `/api/v1/enquiry` endpoint
  - [ ] Save lead to database (leads table)
  - [ ] Return `lead_id` (UUID) as per API contract
  - [ ] Add validation (express-validator)
  - [ ] Error handling

- [ ] **Email Service**
  - [ ] Create `services/backend/src/services/email.js`
  - [ ] Implement SES email sending
  - [ ] Integrate with enquiry endpoint (send confirmation email)
  - [ ] Test email sending

- [ ] **Dashboard List View**
  - [ ] Create backend endpoint `GET /api/v1/leads`
  - [ ] Create `frontend/src/pages/Dashboard.jsx`
  - [ ] Add routing in frontend
  - [ ] Create leads API client
  - [ ] Style dashboard with Tailwind

### Priority 2: LLM Features (Core for Week 1)

- [ ] **LLM Service Implementation**
  - [ ] Get EC2 private IP address (from AWS)
  - [ ] Create `services/backend/src/services/llm.js`
  - [ ] Implement Ollama client (HTTP client to Ollama API)
  - [ ] Create `services/backend/src/routes/llm.js` with inference endpoint
  - [ ] Implement prompt template loading from `reference/prompt-templates.md`
  - [ ] Implement JSON schema validation
  - [ ] Test LLM endpoint

- [ ] **Latency Benchmark**
  - [ ] Create benchmark script
  - [ ] Run benchmarks with different prompts
  - [ ] Document results

### Priority 3: Integration & Testing

- [ ] **End-to-End Testing**
  - [ ] Test form submission → DB save → email
  - [ ] Test LLM inference endpoint
  - [ ] Test dashboard loads leads
  - [ ] Verify all Week 1 deliverables work

## 🗂️ Data Model Implementation

According to `reference/README.md`, the leads table should have:
```sql
leads {
  id UUID PRIMARY KEY,
  name VARCHAR,
  phone VARCHAR,
  email VARCHAR,
  source VARCHAR,
  created_at TIMESTAMP,
  status VARCHAR
}
```

**Note:** The reference shows a simplified schema. We may need additional fields for `enquiry_type` and `notes` from the API contract.

## 🔧 Technical Requirements

### Database Connection
- Use AWS Secrets Manager to get RDS credentials (already configured in Terraform)
- Connection string format: `postgresql://username:password@host:5432/dbname`
- Use environment variable `DB_SECRET_ARN` (already set in ECS task definition)

### LLM Service
- Ollama runs on EC2 instance: `i-0548f3187e7f87967`
- Port: 11434
- Default model: Check what userdata script installs
- API endpoint: `http://<ec2-private-ip>:11434/api/generate`
- Need EC2 instance private IP (can get from AWS Console or CLI)

### Email Service
- SES Region: `us-east-1`
- Verified email: `ryangomez9965@gmail.com`
- Domain: `www.soyl.cloud` (needs DNS verification)
- Use AWS SDK v2 (already in dependencies)

## 📊 Estimated Time Remaining

| Task | Effort | Priority |
|------|--------|----------|
| Database Connection & Migrations | 2-3 hours | P1 |
| Enquiry Endpoint Implementation | 2-3 hours | P1 |
| Email Service | 2-3 hours | P1 |
| Dashboard List View | 4-6 hours | P1 |
| LLM Service Implementation | 6-8 hours | P2 |
| Latency Benchmark | 2-3 hours | P2 |
| Integration Testing | 3-4 hours | P3 |
| **TOTAL** | **21-30 hours** | |

**Estimated Completion Time:** 3-4 days of focused work

## 🎯 Week 1 Completion Criteria

Week 1 is complete when:

1. ✅ **Leads stored in DB** - Form submission saves lead to RDS
2. ✅ **Confirmation emails** - Email sent after lead is saved
3. ✅ **LLM inference endpoint** - `/api/v1/llm/infer` endpoint works
4. ✅ **Dashboard list** - Dashboard page shows list of leads
5. ✅ **All infrastructure deployed** - ✅ Already done

## 📝 Next Steps

1. **Start with Database** - Connect backend to RDS and create migrations
2. **Implement Enquiry Endpoint** - Make the lead form functional
3. **Add Email Service** - Send confirmation emails
4. **Build Dashboard** - Create leads list view
5. **Implement LLM Service** - Connect to Ollama and create inference endpoint
6. **Run Benchmarks** - Measure LLM latency
7. **Integration Testing** - Verify end-to-end flow

---

**Last Updated:** Based on reference/README.md Week 1 requirements
**Status:** Infrastructure deployed ✅ | Functional implementation needed ❌

