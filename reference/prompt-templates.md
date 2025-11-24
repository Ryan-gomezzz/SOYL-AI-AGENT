# Prompt Templates

This file contains all LLM prompt templates used by the SOYL AI Agent system. All prompts must follow the evidence-first approach and include proper schema validation.

## Template Versioning

All templates must include a version number. Format: `{template_name}_v{version}`

## Template Structure

Each template should include:
- **Purpose**: What the template is used for
- **Input Schema**: Expected input format
- **Output Schema**: Expected output format
- **Temperature**: Recommended temperature setting
- **Evidence Requirements**: Whether evidence blocks are required

---

## Template: intent_extraction_v1

**Purpose**: Extract user intent and key information from customer inquiries.

**Input Schema**:
```json
{
  "transcript_chunks": [
    {
      "chunk_id": "string",
      "text": "string",
      "timestamp": "string"
    }
  ],
  "context": {
    "lead_id": "uuid",
    "enquiry_type": "string",
    "previous_interactions": []
  }
}
```

**Output Schema**:
```json
{
  "intent": "string",
  "confidence": "float (0-1)",
  "entities": {
    "service_type": "string",
    "urgency": "string",
    "budget_range": "string"
  },
  "evidence_chunks": ["chunk_id"],
  "next_action": "string"
}
```

**Prompt Template**:
```
You are an AI assistant specialized in extracting intent from customer inquiries for Chartered Accountant firms.

Analyze the following conversation transcript and extract:
1. Primary intent of the customer
2. Key entities (service type, urgency, budget)
3. Evidence chunks that support your analysis
4. Recommended next action

Transcript Chunks:
{transcript_chunks}

Context:
- Lead ID: {lead_id}
- Enquiry Type: {enquiry_type}
- Previous Interactions: {previous_interactions}

Requirements:
- Provide confidence score (0-1)
- Reference specific chunk IDs as evidence
- Use JSON schema validation
- If confidence < 0.65, mark for human review

Output your analysis in the following JSON format:
{
  "intent": "...",
  "confidence": 0.0-1.0,
  "entities": {
    "service_type": "...",
    "urgency": "...",
    "budget_range": "..."
  },
  "evidence_chunks": ["chunk_id1", "chunk_id2"],
  "next_action": "..."
}
```

**Temperature**: 0.0 (deterministic extraction)
**Evidence Required**: Yes
**Schema Validation**: Required

---

## Template: post_call_summary_v1

**Purpose**: Generate a summary of the call after completion.

**Input Schema**:
```json
{
  "call_id": "uuid",
  "lead_id": "uuid",
  "transcript": "string",
  "duration_seconds": "integer",
  "call_metadata": {
    "started_at": "iso_datetime",
    "ended_at": "iso_datetime",
    "recording_s3_key": "string"
  }
}
```

**Output Schema**:
```json
{
  "summary": "string",
  "key_points": ["string"],
  "action_items": [
    {
      "item": "string",
      "priority": "high|medium|low",
      "assigned_to": "string"
    }
  ],
  "sentiment": "positive|neutral|negative",
  "follow_up_required": "boolean",
  "tags": ["string"]
}
```

**Prompt Template**:
```
You are an AI assistant that summarizes customer calls for a Chartered Accountant firm.

Generate a comprehensive summary of the following call:

Call Details:
- Call ID: {call_id}
- Lead ID: {lead_id}
- Duration: {duration_seconds} seconds
- Started: {started_at}
- Ended: {ended_at}

Transcript:
{transcript}

Requirements:
1. Create a concise summary (2-3 paragraphs)
2. Extract key points discussed
3. Identify action items with priorities
4. Assess overall sentiment
5. Determine if follow-up is required
6. Add relevant tags for categorization

Output your summary in the following JSON format:
{
  "summary": "...",
  "key_points": ["...", "..."],
  "action_items": [
    {
      "item": "...",
      "priority": "high|medium|low",
      "assigned_to": "..."
    }
  ],
  "sentiment": "positive|neutral|negative",
  "follow_up_required": true|false,
  "tags": ["tag1", "tag2"]
}
```

**Temperature**: 0.3 (balanced creativity and accuracy)
**Evidence Required**: Yes (transcript)
**Schema Validation**: Required

---

## Template: followup_email_v1

**Purpose**: Generate follow-up emails based on call summaries and lead information.

**Input Schema**:
```json
{
  "lead_id": "uuid",
  "lead_name": "string",
  "lead_email": "string",
  "call_summary": {
    "summary": "string",
    "key_points": ["string"],
    "action_items": ["string"]
  },
  "enquiry_type": "string",
  "next_steps": "string"
}
```

**Output Schema**:
```json
{
  "subject": "string",
  "body_html": "string",
  "body_text": "string",
  "priority": "high|medium|low",
  "send_immediately": "boolean"
}
```

**Prompt Template**:
```
You are an AI assistant that generates professional follow-up emails for a Chartered Accountant firm.

Generate a follow-up email based on the following information:

Lead Information:
- Name: {lead_name}
- Email: {lead_email}
- Enquiry Type: {enquiry_type}

Call Summary:
{call_summary}

Next Steps:
{next_steps}

Requirements:
1. Professional and courteous tone
2. Reference specific points from the call
3. Include clear next steps
4. Provide both HTML and plain text versions
5. Appropriate subject line
6. Set priority based on urgency

Output your email in the following JSON format:
{
  "subject": "...",
  "body_html": "<html>...</html>",
  "body_text": "...",
  "priority": "high|medium|low",
  "send_immediately": true|false
}
```

**Temperature**: 0.5 (balanced professional tone)
**Evidence Required**: Yes (call summary)
**Schema Validation**: Required

---

## Template: initial_greeting_v1

**Purpose**: Generate initial greeting when customer first contacts.

**Input Schema**:
```json
{
  "lead_name": "string",
  "enquiry_type": "string",
  "source": "website|phone|referral"
}
```

**Output Schema**:
```json
{
  "greeting": "string",
  "tone": "professional|friendly|formal",
  "next_question": "string"
}
```

**Prompt Template**:
```
You are an AI assistant for a Chartered Accountant firm. Generate an appropriate initial greeting.

Lead Information:
- Name: {lead_name}
- Enquiry Type: {enquiry_type}
- Source: {source}

Requirements:
1. Professional yet friendly tone
2. Acknowledge the enquiry type
3. Set appropriate expectations
4. Include a natural next question to continue conversation

Output in JSON format:
{
  "greeting": "...",
  "tone": "professional|friendly|formal",
  "next_question": "..."
}
```

**Temperature**: 0.4
**Evidence Required**: No
**Schema Validation**: Required

---

## Usage Guidelines

### Temperature Settings
- **0.0**: Deterministic tasks (extraction, classification)
- **0.2-0.3**: Summarization, structured output
- **0.4-0.5**: Content generation, emails
- **0.7+**: Creative tasks (not recommended for CA firm use)

### Evidence Requirements
- Always include evidence chunks when available
- Reference specific transcript segments
- Provide confidence scores for critical decisions
- Mark for human review if confidence < 0.65

### Schema Validation
- All outputs must conform to specified JSON schemas
- Use JSON schema validation library
- Reject invalid outputs and retry or route to human review

### Error Handling
- If template fails, use fallback template
- Log all template usage for monitoring
- Track success rates and latency

## Template Updates

When updating templates:
1. Increment version number
2. Update this file
3. Update application code to use new version
4. Test thoroughly before deployment
5. Maintain backward compatibility when possible

## Current Active Templates

- `intent_extraction_v1` - Active
- `post_call_summary_v1` - Active
- `followup_email_v1` - Active
- `initial_greeting_v1` - Active

## Model Configuration

**Current Model**: Llama 3.2 8B
**Base URL**: `http://<ec2-private-ip>:11434`
**Timeout**: 30 seconds
**Max Retries**: 3

For fine-tuned models, see: `docs/OLLAMA_FINE_TUNED_MODEL_SETUP.md`
