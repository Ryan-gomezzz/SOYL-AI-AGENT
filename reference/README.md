# Project Reference — AI CA Agent (Canonical Source of Truth)

## Purpose

This file is the canonical reference for all humans and automation (Cursor, CI AIs, build scripts).

Every automated agent (Cursor or other LLM) MUST read and obey this file before producing infra, code, or prompts. If anything in generated output conflicts with this file, that output must be considered incorrect.

## Quick facts (project meta)

- **Project name**: ai-ca-agent
- **Primary goal**: Build a vertical, India-first voice-native AI agent for CA firms (lead intake → AI call → transcript → auto-summary → follow-up).
- **Primary infra**: AWS (S3, RDS Postgres, EC2 GPU/SageMaker for Ollama, OpenSearch, Amazon Connect, SES, Transcribe, Polly).
- **Team**: 3 engineers (A: infra, B: LLM/agent, C: frontend)
- **Timeline**: 8 weeks (detailed plan is in WEEK sections below)

## How to use this file (MANDATORY)

1. Read this file fully before generating anything.
2. When an AI (Cursor or other) proposes changes, the PR description must include the path `reference/README.md` and the exact section(s) referenced. Example: `Ref: reference/README.md -> WEEK 2 - Engineer A - Amazon Connect`.
3. If a generated artifact introduces behavior not described here, mark it as DEVIATION and require human approval.
4. All LLM prompts used by the system must be stored under `/reference/prompt-templates.md` and referenced by file name & version in PRs.

## Canonical 8-week plan (summarized)

### WEEK 1 — FOUNDATIONS & CORE PIPELINE

**Goals**: Infra up, lead intake pipeline ready, codebases ready.

- **Engineer A**: IAM, VPC, subnets; RDS Postgres; S3 buckets; SES; Lambda; API Gateway; ECS Fargate; Terraform skeleton. (3–4d)
- **Engineer B**: EC2 GPU; install Ollama; LLM API; latency benchmark; prompt templates. (3–4d)
- **Engineer C**: React + Tailwind lead form; API integration; minimal dashboard. (3–4d)

**Deliverables**: Leads stored in DB; confirmation emails; LLM inference endpoint; dashboard list.

### WEEK 2 — BASIC CALLING + RECORDING PIPELINE

- **Engineer A**: Amazon Connect setup, outbound flow, S3 recording pipeline. (4–5d)
- **Engineer B**: Batch Transcribe worker. (3d)
- **Engineer C**: Dashboard: transcripts, status, summary. (3d)

**Deliverables**: Call, recordings in S3, transcripts, dashboard shows transcripts.

### WEEK 3 — LLM POST-CALL SUMMARIZATION + CA EMAILS

LLM pipelines, worker system, dashboard 2.0. (3d each)

**Deliverables**: Post-call automation, CA summaries, enriched leads.

### WEEK 4 — REAL-TIME AI AGENT (Phase 1)

Streaming STT/TTS integration, Connect WebSocket orchestration, agent control UI. (3–5d)

### WEEK 5 — MEMORY SYSTEM (Phase 1)

OpenSearch k-NN, chunking, MiniLM embeddings, retrieval service, profile page. (3–4d)

### WEEK 6 — REAL-TIME AGENT (Phase 2: Polished)

Prompt compression, token streaming, warm LLM instances, autoscaling, agent DSL. (4–5d)

### WEEK 7 — ENTERPRISE HARDENING

Monitoring, alerts, dead-letter queues, hallucination reduction (evidence-first), RBAC. (4–5d)

### WEEK 8 — QA, POLISH, EDGE CASES

Stress tests, 150+ calls, compliance, final latency tuning.

## Approved architecture & flows (high-level)

- **Frontend**: React + Tailwind hosted on S3 + CloudFront or Vercel (staging).
- **API**: API Gateway → Lambda (Node) for ingestion; heavy workers on ECS Fargate.
- **DB**: Amazon RDS Postgres for structured data.
- **Storage**: S3 for recordings/transcripts.
- **Vector DB**: OpenSearch k-NN.
- **LLM**: Ollama 3.18B on EC2 GPU.
- **Telephony**: Amazon Connect.
- **STT/TTS**: Amazon Transcribe + Amazon Polly.
- **Email**: Amazon SES.

## Data model (canonical)

```sql
leads { id, name, phone, email, source, created_at, status }
calls { id, lead_id, connect_contact_id, recording_s3_key, duration, started_at, ended_at }
transcripts { id, call_id, s3_key, transcript_text, created_at }
memory_summaries { id, lead_id, summary_text, tags, created_at }
llm_results { id, call_id, result_json, prompt_hash, created_at }
```

**Migrations**: use a migration tool. LLM MUST NOT run DB migrations directly.

## API contract (EXAMPLE)

**POST /enquiry**

Request JSON:
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "enquiry_type": "string",
  "notes": "optional string"
}
```

Response: 201
```json
{
  "lead_id": "<uuid>",
  "message": "Received"
}
```

Changes to API must update `/reference/api-spec.yaml`.

## Prompt templates & rules (see /reference/prompt-templates.md)

- `intent_extraction_v1`
- `post_call_summary_v1`
- `followup_email_v1`

**Rules**: evidence blocks required; temperature=0 for extraction; JSON schema enforcement.

## JSON schemas (see /reference/json-schemas/)

- `intent-extraction.schema.json` (strict JSON schema for extraction tasks)

## Hallucination & verification rules (CRITICAL)

1. **Evidence-first**: LLM must include sources referencing transcript chunk IDs.
2. **Schema enforcement**: validate LLM outputs; else route to human review.
3. **Confidence threshold**: evidence similarity < 0.65 => human review.
4. **No automatic destructive actions**.

## CI / PR rules for LLM-generated content

- PR must include `REFERENCE-SECTION: <path>` line pointing to this file section.
- PRs that modify `/reference/*` require MAINTAINER label & two approvals.
- Terraform changes require plan artifact attachment.

## Developer conventions

- **Backend**: Node 18, TypeScript preferred, ESLint, Prettier.
- **Frontend**: React + Tailwind, Vite.
- **Terraform state**: S3 + DynamoDB locking.
- **Secrets**: AWS Secrets Manager only.

## Ops runbook highlights

- SES DNS TXT verification needed.
- RDS credentials rotate after initial setup.
- EC2 Ollama: model weights in S3 only; IAM role required.
- Daily smoke tests: place test call → verify transcript → verify LLM summary.

## Change control & ownership

- `reference/README.md` owned by founding engineers. Edits require two approvals.
- Prompt updates require evaluation metrics & deployment plan.

## Emergency safe-mode

`LLM_SAFE_MODE=true` will: set temperature=0, disable auto-send emails, route outputs to human queue.

`scripts/enable-safe-mode.sh` must be present and manually executable.

## Contacts

- **Engineer A (Infra lead)**: <fill>
- **Engineer B (LLM lead)**: <fill>
- **Engineer C (Frontend lead)**: <fill>

---

**END OF CANONICAL REFERENCE**

