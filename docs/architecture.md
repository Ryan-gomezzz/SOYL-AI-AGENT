# SOYL AI Agent - Architecture Documentation

## Week 1 Infrastructure Topology

### Overview
The SOYL AI Agent system is designed as a cloud-native application running on AWS infrastructure. The architecture follows a microservices pattern with serverless and containerized components.

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (HTTP API)                    │
│                    POST /enquiry                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Function                           │
│              (Enquiry Handler)                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│   RDS         │              │   S3 Buckets  │
│  PostgreSQL   │              │  (Recordings, │
│               │              │  Transcripts) │
└───────────────┘              └───────────────┘
        │                               │
        └───────────────┬───────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ECS Fargate Cluster                       │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │  Backend        │         │  Worker         │           │
│  │  Service        │         │  Service        │           │
│  └─────────────────┘         └─────────────────┘           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    EC2 GPU Instance                          │
│                    (Ollama LLM Service)                      │
│                    Port: 11434                               │
└─────────────────────────────────────────────────────────────┘
```

### Networking

- **VPC**: 10.0.0.0/16
- **Public Subnets**: 2 subnets across 2 AZs (10.0.1.0/24, 10.0.2.0/24)
- **Private Subnets**: 2 subnets across 2 AZs (10.0.10.0/24, 10.0.11.0/24)
- **Internet Gateway**: For public subnet internet access
- **NAT Gateways**: 2 NAT gateways (one per public subnet) for private subnet internet access

### Security Groups

1. **Bastion SG**: SSH access (port 22) - **MUST be locked down in production**
2. **ECS SG**: Application port (3000) from ALB
3. **DB SG**: PostgreSQL (port 5432) from private subnets and ECS
4. **EC2 SG**: SSH from bastion, Ollama API (port 11434) from ECS
5. **ALB SG**: HTTP (80) and HTTPS (443) from internet

## Data Model

### Core Entities

#### 1. Lead/Enquiry
```sql
CREATE TABLE enquiries (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Call
```sql
CREATE TABLE calls (
    id SERIAL PRIMARY KEY,
    enquiry_id INTEGER REFERENCES enquiries(id),
    phone_number VARCHAR(20),
    call_duration INTEGER, -- in seconds
    recording_s3_key VARCHAR(500),
    status VARCHAR(50) DEFAULT 'initiated',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. Transcript
```sql
CREATE TABLE transcripts (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES calls(id),
    transcript_s3_key VARCHAR(500),
    raw_transcript TEXT,
    processed_transcript TEXT,
    language VARCHAR(10) DEFAULT 'en',
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. LLM Results
```sql
CREATE TABLE llm_results (
    id SERIAL PRIMARY KEY,
    transcript_id INTEGER REFERENCES transcripts(id),
    enquiry_id INTEGER REFERENCES enquiries(id),
    model_name VARCHAR(100),
    prompt TEXT,
    response TEXT,
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Telephony Layer — Decision Update (Twilio)

We will use **Twilio Voice** as our telephony/contact center platform. Amazon Connect was evaluated but cannot be used because our AWS account is provisioned by AISPL (Amazon Internet Services Private Limited), and AISPL accounts are not permitted to create Amazon Connect instances due to region/reseller/telephony regulatory restrictions. Twilio provides a global, webhook-driven telephony API that integrates directly with our AWS backend (API Gateway + Lambda), requires no special account conversion, and supports both inbound and outbound voice, recording, and real-time audio streaming via WebSockets if needed.

### Key Points

- **Telephony Provider**: Twilio Voice (phone numbers provisioned via Twilio Console or REST API)
- **Webhook Model**: Twilio → HTTP(S) webhook → API Gateway → Lambda → AI Engine (VAPI) → Response (TwiML or outbound audio)
- **Recordings & Transcripts**: Stored in S3; logs in CloudWatch
- **CI/CD**: Twilio webhook URL will be registered during deployment using `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` secrets

### Twilio Integration Architecture

```
[Caller / PSTN] <---> Twilio Phone Number
                     |
                     | Twilio Webhook (HTTP POST)
                     |
                     ▼
              API Gateway (HTTPS)
                     |
                     ▼
            Lambda (twilio-webhook)
                     |
        [Auth/Sign-check | Parse | Business logic]
                     |
            -> AI Agent (VAPI or in-house model) <-- optional DB
                     |
            Return TwiML or stream audio
                     |
                  Twilio (plays audio / connects call)
                     |
        (Recordings -> S3 ; Logs -> CloudWatch)
```

**Note**: Amazon Connect evaluation aborted due to AISPL account restrictions; replaced by Twilio Voice.

## Call Flow

### 1. Enquiry Submission Flow

```
User → API Gateway → Lambda → RDS (save enquiry)
                              ↓
                         SQS Queue (optional)
                              ↓
                         Worker Service
                              ↓
                         Initiate Call
```

### 2. Inbound Call Flow (Twilio)

```
Caller dials Twilio number
     ↓
Twilio posts call event to POST /twilio/webhook
     ↓
API Gateway receives request and invokes twilio-webhook Lambda
     ↓
Lambda verifies X-Twilio-Signature, parses caller/call SID
     ↓
Lambda calls AI agent (VAPI or internal endpoint) for response
     ↓
Lambda returns TwiML (play text-to-speech, gather DTMF, record)
     ↓
Twilio executes TwiML and plays audio/connects call
     ↓
Twilio uploads recordings to S3 (via webhook)
     ↓
Recording events trigger Lambda → Store in RDS
     ↓
Worker processes recording → Transcription → LLM → Email
```

### 3. Outbound Call Flow (Twilio)

```
Backend requests Twilio to create outbound call via REST API
     ↓
Twilio calls the answerUrl webhook when called party answers
     ↓
Webhook points to same Lambda pipeline
     ↓
Lambda returns TwiML that connects to AI engine/plays TTS
     ↓
Call recording and processing follows same flow as inbound
```

### 4. Call Processing Flow (Post-Call)

```
Call Recording → S3 (recordings bucket)
     ↓
Worker Service Processes Recording
     ↓
Transcription Service (e.g., AWS Transcribe)
     ↓
Transcript Saved to S3 (transcripts bucket)
     ↓
Transcript Record Saved to RDS
     ↓
Worker Sends Transcript to Ollama (EC2 GPU)
     ↓
LLM Response Generated
     ↓
LLM Result Saved to RDS
     ↓
Confirmation Email Sent via SES
```

### 5. Data Flow Diagram (Text)

```
┌──────────┐
│   User   │
└────┬─────┘
     │ POST /enquiry
     ▼
┌──────────────┐
│ API Gateway  │
└────┬─────────┘
     │
     ▼
┌──────────┐     ┌──────┐     ┌──────────────┐
│ Lambda   │────▶│ RDS  │────▶│ SQS Queue    │
│ Handler  │     │      │     │ (optional)   │
└──────────┘     └──────┘     └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Worker     │
                              │   Service    │
                              └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │   S3     │    │   EC2     │    │   SES    │
              │ Recordings│   │  Ollama   │    │   Email  │
              └──────────┘    └──────────┘    └──────────┘
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │     RDS      │
                              │ (Transcripts,│
                              │  LLM Results)│
                              └──────────────┘
```

## Storage Strategy

### S3 Buckets

1. **Recordings Bucket**: Raw call recordings (audio files)
   - Lifecycle: Move to Glacier after 90 days, delete after 1 year
   - Encryption: SSE-KMS

2. **Transcripts Bucket**: Processed transcripts (JSON/text files)
   - Lifecycle: Delete after 2 years
   - Encryption: SSE-KMS

3. **Static Assets Bucket**: Frontend assets, model weights pointers
   - Lifecycle: No expiration
   - Encryption: SSE-KMS

### Model Weights Storage

- **NOT stored on EC2**: Model weights are stored in S3 or external registry
- **EC2 Role**: Has S3 read permissions to fetch model weights on demand
- **Ollama**: Downloads models from S3 or external source on first use

## Security Considerations

1. **Secrets Management**: All database credentials stored in AWS Secrets Manager
2. **Network Isolation**: RDS in private subnets, no direct internet access
3. **Encryption**: All S3 buckets use SSE-KMS, RDS encryption at rest
4. **IAM**: Least-privilege policies for all roles
5. **Bastion Access**: Currently open - **MUST be restricted** to specific IPs in production

## Scalability

- **ECS Fargate**: Auto-scaling based on CPU/memory metrics
- **Lambda**: Automatic scaling based on request volume
- **RDS**: Can be upgraded to larger instance or read replicas
- **S3**: Unlimited storage, handles any volume

## Monitoring & Logging

- **CloudWatch Logs**: All services log to CloudWatch
- **CloudWatch Metrics**: Custom metrics for call processing, LLM inference
- **ECS Container Insights**: Enabled for container-level monitoring
- **RDS Performance Insights**: Can be enabled for database monitoring

## Future Enhancements

1. Add Application Load Balancer for ECS services
2. Implement Redis/ElastiCache for session management
3. Add SQS queues for async job processing
4. Implement CloudFront for static asset delivery
5. Add WAF for API Gateway protection
6. Implement CI/CD pipeline with GitHub Actions or AWS CodePipeline

