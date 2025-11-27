# Week 2 Tasks Summary

**Ref**: `reference/README.md -> WEEK 2 — BASIC CALLING + RECORDING PIPELINE`

## Overview

Week 2 focuses on building the basic calling and recording pipeline. Engineer B's Batch Transcribe worker is now complete. Engineer B's LLM/Agent work is scheduled for Week 3.

**Deliverables**: Call, recordings in S3, transcripts, dashboard shows transcripts.

**Note**: Amazon Connect evaluation aborted due to AISPL account restrictions; replaced by Twilio Voice. See `docs/architecture.md` for details.

---

## Engineer A - Infrastructure (Week 2)

**Timeline**: 4-5 days  
**Status**: ✅ Lambda Functions Deployed

### Tasks

#### 1. Twilio Voice Setup
- [x] Create Twilio webhook Lambda handler (`infra/lambda/twilio-webhook/handler.js`)
- [x] Configure API Gateway endpoint for Twilio webhooks
- [ ] Set up phone number (buy via Twilio Console/API) - **MANUAL STEP REQUIRED** (see Manual Steps section)
- [ ] Configure webhook URL for phone number - **MANUAL STEP REQUIRED** (see Manual Steps section)
- [x] Set up S3 bucket for recordings (already exists)
- [x] Configure Lambda IAM role for S3 access and CloudWatch logging

#### 2. Outbound Call Flow
- [x] Create Twilio webhook handler for outbound calls (Lambda: `twilio-webhook/handler.js`)
- [x] Configure TwiML generation for:
  - Initiate calls to leads ✅
  - Record calls automatically ✅
  - Handle call events (answered, busy, no answer) ✅
  - Store contact metadata ✅
- [x] Set up Lambda integration for webhook triggers
- [x] Configure call recording settings (TwiML `<Record>` verb)
- [ ] **MANUAL**: Test outbound call via Twilio API (see Manual Steps)

#### 3. S3 Recording Pipeline
- [x] Configure Twilio to save recordings to S3 recordings bucket (via webhook callback)
- [x] Set up S3 event notifications for new recordings (Terraform: `aws_s3_bucket_notification`)
- [x] Create Lambda function to process recording events (`infra/lambda/twilio-webhook/handler.js`)
- [x] Update database schema for calls table (Migration: `002_add_connect_fields.sql` - note: field renamed to `twilio_call_sid`)
- [ ] **MANUAL**: Test end-to-end: Call → Recording → S3 → Event → Database (see Manual Steps)

### Infrastructure Requirements

**Twilio Resources Needed**:
- Twilio Account (created manually)
- Twilio Phone Number (purchased via API/Console)
- Lambda function for Twilio webhook processing
- API Gateway endpoint for webhooks
- IAM roles and policies for Lambda (S3, CloudWatch)
- S3 bucket policy for recordings (already configured)

**S3 Bucket Configuration**:
- Recordings bucket already exists: `ai-ca-agent-staging-recordings-us-east-1`
- Need to configure Connect to use this bucket
- Set up lifecycle policies (already configured)

**Database Schema**:
- `calls` table exists (from Week 1)
- Fields needed:
  - `twilio_call_sid` (replaces `connect_contact_id`)
  - `recording_status`
  - `recording_processed_at`

### Key Files to Create/Modify

1. **Lambda**:
   - `infra/lambda/twilio-webhook/handler.js` - Process Twilio webhooks
   - TwiML generation for call handling

2. **Scripts**:
   - `scripts/twilio/buy_number.sh` - Purchase Twilio phone number
   - `scripts/twilio/provision_webhook.sh` - Configure webhook URL

3. **Terraform**:
   - `infra/terraform/twilio-provider.tf` - Documentation and outputs
   - `infra/terraform/lambda.tf` - Update for Twilio webhook Lambda
   - `infra/terraform/s3.tf` - S3 bucket policies (already configured)

4. **Backend**:
   - `services/backend/src/routes/calls.js` - New route for call management
   - `services/backend/src/services/twilio.js` - Twilio service integration

---

## Engineer B - Batch Transcribe Worker (Week 2)

**Timeline**: 3 days  
**Status**: ✅ Completed

### Tasks

#### 1. Batch Transcribe Worker Implementation
- [x] Create transcribe worker service (`services/worker/src/transcribe-worker.js`)
- [x] Implement S3 event monitoring (Lambda + polling mode)
- [x] Implement AWS Transcribe job submission
- [x] Implement transcription job status polling
- [x] Implement transcript download and processing
- [x] Save transcripts to S3 (transcripts bucket)
- [x] Save transcripts to database (transcripts table)
- [x] Update call records with transcription status
- [x] Add error handling and retries
- [x] Add idempotency checks

#### 2. Infrastructure Setup
- [x] Create Lambda function for transcribe worker
- [x] Deploy Lambda functions via Terraform (✅ Completed)
- [x] Configure S3 event notifications for recordings bucket
- [x] Add IAM permissions for AWS Transcribe
- [x] Add IAM permissions for S3 access
- [x] Configure Lambda VPC access for RDS
- [x] Set up CloudWatch logging

#### 3. Database Integration
- [x] Create database config module (`services/worker/src/config/database.js`)
- [x] Integrate with existing calls table
- [x] Integrate with transcripts table
- [x] Handle call record creation/updates
- [x] Implement transcript storage

### Key Files Created/Modified

1. **Worker Service**:
   - `services/worker/src/transcribe-worker.js` - Main transcribe worker
   - `services/worker/src/config/database.js` - Database configuration
   - `services/worker/src/worker.js` - Updated to use transcribe worker

2. **Terraform**:
   - `infra/terraform/lambda.tf` - Added transcribe worker Lambda
   - `infra/terraform/iam.tf` - Added Transcribe permissions
   - `infra/terraform/s3.tf` - Updated S3 notifications

3. **Documentation**:
   - `docs/WEEK2_ENGINEER_B_TRANSCRIBE.md` - Implementation guide

### Features

- **Event-driven**: Lambda triggered by S3 events
- **Polling mode**: Can also run as long-running service
- **AWS Transcribe**: Batch transcription with job monitoring
- **Database integration**: Auto-creates call records, saves transcripts
- **Error handling**: Retries, status tracking, comprehensive logging
- **Idempotency**: Prevents duplicate transcriptions

### Testing

- [ ] Test with sample recording file
- [ ] Verify S3 event triggers Lambda
- [ ] Verify transcription job completes
- [ ] Verify transcript saved to S3 and database
- [ ] Test error handling (invalid files, failed jobs)

---

## Lambda Functions Deployment Status

**Date**: 2024-11-27  
**Status**: ✅ All Lambda Functions Deployed

### Deployed Lambda Functions

1. **Enquiry Handler** (`ai-ca-agent-staging-enquiry-handler`)
   - ✅ Deployed and updated via Terraform
   - ✅ Connected to API Gateway (`POST /enquiry`)
   - ✅ VPC configuration for RDS access
   - ✅ Environment variables configured
   - ✅ CloudWatch logging enabled

2. **Connect Handler** (`ai-ca-agent-staging-connect-handler`)
   - ✅ Deployed via Terraform
   - ⚠️ Deprecated (Connect replaced by Twilio, but kept for backward compatibility)
   - ✅ S3 event notifications configured
   - ✅ VPC configuration for RDS access

3. **Transcribe Worker** (`ai-ca-agent-staging-transcribe-worker`)
   - ✅ Deployed via Terraform
   - ✅ S3 event notifications configured for recordings bucket
   - ✅ AWS Transcribe permissions configured
   - ✅ VPC configuration for RDS access
   - ✅ Timeout: 15 minutes (900 seconds)

### Deployment Notes

- All Lambda packages built and deployed via Terraform
- Security groups configured for VPC access
- IAM roles and policies properly configured
- S3 bucket notifications active for automatic Lambda invocation
- CloudWatch log groups created with 7-day retention

### Next Steps

- [ ] Test Lambda functions with sample events
- [ ] Monitor CloudWatch logs for errors
- [ ] Verify S3 event triggers work correctly
- [ ] Test end-to-end call → recording → transcription flow

---

## Engineer C - Frontend (Week 2)

**Timeline**: 3 days  
**Status**: Not Started

### Tasks

#### 1. Dashboard: Transcripts Display
- [x] Create transcripts list component (`frontend/src/components/TranscriptsList.jsx`)
- [x] Display transcripts from API (`frontend/src/api/transcripts.js`)
- [x] Show transcript metadata (call ID, date, duration)
- [x] Add transcript detail view (`frontend/src/components/TranscriptDetail.jsx`)
- [x] Implement transcript search/filter
- [x] Backend API routes (`services/backend/src/routes/transcripts.js`)

#### 2. Dashboard: Status Display
- [x] Show call status for each lead
- [x] Display call status indicators (pending, in-progress, completed, failed)
- [x] Add status filters
- [x] Show call duration and timestamps
- [x] Call status component (`frontend/src/components/CallStatus.jsx`)
- [x] Backend API routes (`services/backend/src/routes/calls.js`)

#### 3. Dashboard: Summary Display
- [x] Display call summaries (if available from Week 3)
- [x] Show LLM-generated summaries
- [x] Add summary view/expand functionality
- [x] Format summary display nicely
- [x] Summary component (`frontend/src/components/SummaryCard.jsx`)
- [x] Dashboard tabs integration (`frontend/src/pages/Dashboard.jsx`)

### Frontend Components to Create

1. **Components**:
   - `frontend/src/components/TranscriptsList.jsx` - List of transcripts
   - `frontend/src/components/TranscriptDetail.jsx` - Single transcript view
   - `frontend/src/components/CallStatus.jsx` - Status indicators
   - `frontend/src/components/SummaryCard.jsx` - Summary display

2. **Pages**:
   - `frontend/src/pages/Transcripts.jsx` - Transcripts page
   - `frontend/src/pages/Calls.jsx` - Calls management page (if needed)

3. **API Integration**:
   - `frontend/src/api/transcripts.js` - API client for transcripts
   - `frontend/src/api/calls.js` - API client for calls
   - Update `frontend/src/api/leads.js` if needed

### Backend API Endpoints Needed

1. **GET /api/v1/transcripts**
   - List all transcripts
   - Query params: `call_id`, `lead_id`, `status`
   - Response: Array of transcript objects

2. **GET /api/v1/transcripts/:id**
   - Get single transcript
   - Response: Full transcript with metadata

3. **GET /api/v1/calls**
   - List all calls
   - Query params: `lead_id`, `status`
   - Response: Array of call objects with status

4. **GET /api/v1/calls/:id**
   - Get single call with transcript
   - Response: Call object with transcript data

### Database Queries Needed

- Query transcripts table
- Join calls and transcripts
- Filter by status, date, lead_id
- Order by created_at

---

## Testing Requirements

### Engineer A Testing
- [ ] Test Connect instance creation
- [ ] Test outbound call flow
- [ ] Verify recordings saved to S3
- [ ] Verify S3 events trigger Lambda
- [ ] Verify call records in database
- [ ] Test error handling (failed calls, no answer, etc.)

### Engineer C Testing
- [ ] Test transcripts list display
- [ ] Test transcript detail view
- [ ] Test status indicators
- [ ] Test search/filter functionality
- [ ] Test API integration
- [ ] Test responsive design
- [ ] Test with real data from database

---

## Dependencies

### Engineer A Depends On
- ✅ Week 1 infrastructure complete
- ✅ S3 buckets created
- ✅ RDS database available
- ✅ Lambda functions working
- ✅ IAM roles configured

### Engineer C Depends On
- ✅ Backend API endpoints (to be created)
- ✅ Database schema for calls/transcripts
- ✅ Frontend deployment working
- ⏳ Transcripts data (from Engineer B's work or test data)

---

## Next Steps

1. **Immediate** (Today):
   - Test backend endpoints
   - Verify services are running
   - Review current database schema

2. **Engineer A** (Start):
   - Research Amazon Connect setup requirements
   - Create Terraform plan for Connect resources
   - Set up Connect instance (may require manual steps)

3. **Engineer C** (Start):
   - Review current frontend structure
   - Create API client for transcripts/calls
   - Design transcript display components
   - Create mock data for development

---

## Notes

- Engineer B's work (Batch Transcribe worker) is delayed
- We can proceed with Engineer A and C tasks
- Transcripts may need to be mocked initially until Engineer B completes work
- Amazon Connect setup may require manual configuration in AWS Console
- Phone number acquisition may take time (approval process)

---

## References

- **Canonical Reference**: `reference/README.md`
- **Architecture**: `docs/architecture.md`
- **Week 1 Tasks**: `docs/WEEK1_REMAINING_TASKS.md`
- **Twilio Voice Docs**: https://www.twilio.com/docs/voice
- **Twilio Webhooks**: https://www.twilio.com/docs/voice/webhooks
- **Twilio API Reference**: https://www.twilio.com/docs/voice/api
- **AWS Transcribe Docs**: https://docs.aws.amazon.com/transcribe/

---

## Manual Steps Required (User Action Needed)

### Twilio Voice Setup - Manual Configuration Steps

After deploying the Lambda function and API Gateway, the following manual steps are required:

**Note**: Amazon Connect evaluation aborted due to AISPL account restrictions; replaced by Twilio Voice.

#### 1. Create Twilio Account and Get Credentials (REQUIRED)
**Location**: Twilio Console → https://console.twilio.com/

**Steps**:
1. Create a Twilio account at https://www.twilio.com/try-twilio
2. Navigate to Console → Account → API Keys & Tokens
3. Copy your **Account SID** and **Auth Token**
4. Store these in AWS Secrets Manager or CI/CD secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`

#### 2. Purchase Twilio Phone Number (REQUIRED)
**Location**: Twilio Console or via API

**Steps**:
1. Set environment variables:
   ```bash
   export TWILIO_ACCOUNT_SID="AC..."
   export TWILIO_AUTH_TOKEN="..."
   ```
2. Get your API Gateway webhook URL (after deployment):
   ```bash
   WEBHOOK_URL="https://<api-gateway-url>/twilio/webhook"
   ```
3. Purchase a phone number:
   ```bash
   # Search for available numbers
   ./scripts/twilio/buy_number.sh IN
   
   # Buy a specific number
   ./scripts/twilio/buy_number.sh IN +91XXXXXXXXXX $WEBHOOK_URL
   ```
4. Save the returned Phone SID for future updates

**Alternative**: Purchase via Twilio Console:
1. Go to Phone Numbers → Buy a number
2. Select country (India: IN, US: US)
3. Choose number and purchase
4. Configure webhook URL in number settings

#### 3. Configure Webhook URL (REQUIRED)
**Location**: Twilio Console or via API

**Steps**:
1. After Lambda and API Gateway are deployed, get the webhook URL:
   ```bash
   WEBHOOK_URL="https://<api-gateway-url>/twilio/webhook"
   ```
2. Update phone number webhook:
   ```bash
   ./scripts/twilio/provision_webhook.sh <PHONE_SID> $WEBHOOK_URL
   ```

**Alternative**: Configure via Twilio Console:
1. Go to Phone Numbers → Manage → Active numbers
2. Click on your phone number
3. Under "Voice & Fax", set:
   - **A CALL COMES IN**: Webhook → `https://<api-gateway-url>/twilio/webhook`
   - **HTTP Method**: POST
4. Save configuration

#### 4. Test Twilio Integration (RECOMMENDED)
**Steps**:
1. Verify Lambda function is deployed and has environment variables:
   - `TWILIO_AUTH_TOKEN`
   - `WEBHOOK_FULL_URL`
   - `VAPI_ENDPOINT` (optional)
   - `VAPI_API_KEY` (optional)
2. Test inbound call:
   - Call your Twilio phone number
   - Verify webhook is called and returns TwiML
   - Check CloudWatch logs for Lambda execution
3. Test outbound call (via Twilio API):
   ```bash
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Calls.json" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
     --data-urlencode "From=+91XXXXXXXXXX" \
     --data-urlencode "To=+91YYYYYYYYYY" \
     --data-urlencode "Url=https://<api-gateway-url>/twilio/webhook"
   ```
4. Verify recording is saved to S3 (if recording is enabled in TwiML)

---

### After Manual Steps Complete

Once all manual steps are done:
1. ✅ Twilio account created and credentials stored
2. ✅ Phone number purchased
3. ✅ Webhook URL configured
4. ✅ Lambda function deployed
5. ✅ API Gateway endpoint active

**Next Steps**:
- Test inbound call flow
- Test outbound call flow
- Verify recordings are saved to S3
- Test end-to-end: Call → Recording → S3 → Event → Database

---

## Deployment Commands

**IMPORTANT**: Deploy Lambda function and API Gateway before configuring Twilio webhooks.

To deploy the Twilio webhook Lambda:

```bash
# Build Lambda package
cd infra/lambda/twilio-webhook
npm install
zip -r twilio-webhook.zip handler.js node_modules package.json

# Deploy via AWS CLI (or use CI/CD)
aws lambda update-function-code \
  --function-name ai-ca-agent-staging-twilio-webhook \
  --zip-file fileb://twilio-webhook.zip

# Set environment variables
aws lambda update-function-configuration \
  --function-name ai-ca-agent-staging-twilio-webhook \
  --environment Variables="{
    TWILIO_AUTH_TOKEN=...,
    WEBHOOK_FULL_URL=https://.../twilio/webhook,
    VAPI_ENDPOINT=...,
    VAPI_API_KEY=...
  }"
```

**Verification**: After deployment:
- Check Lambda function in AWS Console
- Test webhook endpoint with Twilio test credentials
- Verify API Gateway route is configured

---

## ✅ COMPLETED AUTOMATED TASKS

All code and infrastructure has been created. Here's what's been automated:

### Infrastructure (Lambda & Scripts)
- ✅ Twilio webhook Lambda handler (`infra/lambda/twilio-webhook/handler.js`)
- ✅ Twilio phone number purchase script (`scripts/twilio/buy_number.sh`)
- ✅ Twilio webhook provisioning script (`scripts/twilio/provision_webhook.sh`)
- ✅ Lambda IAM roles and policies for S3/CloudWatch
- ✅ S3 bucket policy for recordings (already configured)
- ✅ S3 event notifications configuration
- ✅ Database migration script (`services/backend/src/utils/migrations/002_add_connect_fields.sql`)

### Code
- ✅ Lambda handler for Connect events and S3 recordings
- ✅ Contact flow JSON template (`infra/terraform/connect-contact-flow.json`)
- ✅ Database schema updates for calls table
- ✅ Error handling, retries, idempotency checks
- ✅ Edge case handling (duplicate events, missing data, etc.)

### Scripts Updated
- ✅ `scripts/stop-all-services.ps1` - Added Connect cost notes
- ✅ `scripts/start-all-services.ps1` - Added Connect status check
- ✅ `docs/COST_MANAGEMENT_GUIDE.md` - Added Connect cost information

---

## 📋 ALL MANUAL TASKS YOU NEED TO DO

### Step 1: Apply Terraform (REQUIRED)

**Location**: Terminal/Command Line

**Steps**:
```bash
cd infra/terraform
terraform init    # Download Connect provider if needed
terraform plan    # Review what will be created
terraform apply   # Create Connect resources
```

**What this creates**:
- Connect instance
- IAM roles and policies
- S3 bucket policy
- Lambda function (needs code deployment)
- S3 event notifications

**Verification**:
```bash
# Check IAM role was created
aws iam get-role --role-name ai-ca-agent-staging-connect-service-role

# Check Connect instance (will show in AWS Console)
# Go to: https://console.aws.amazon.com/connect/
```

---

### Step 2: Deploy Lambda Function Code (REQUIRED)

**Location**: Terminal/Command Line

**Steps**:
```bash
cd services/lambda

# Install dependencies
npm install

# Create deployment package
# Note: You'll need to zip the files including node_modules
# For Windows PowerShell:
Compress-Archive -Path connect-handler.js,handler.js,package.json,node_modules -DestinationPath connect-handler.zip -Force

# Or use a build script if available
```

**Alternative**: Use AWS CLI to update function code:
```bash
aws lambda update-function-code \
  --function-name ai-ca-agent-staging-connect-handler \
  --zip-file fileb://connect-handler.zip \
  --region us-east-1
```

**Verification**:
- Check Lambda function in AWS Console
- Verify function code is updated
- Check environment variables are set

---

### Step 3: Run Database Migration (REQUIRED)

**Location**: Terminal/Command Line or Database Client

**Steps**:
1. Connect to your RDS database
2. Run the migration script:
   ```sql
   -- Run: services/backend/src/utils/migrations/002_add_connect_fields.sql
   ```

**Or via psql**:
```bash
psql -h <RDS_ENDPOINT> -U <USERNAME> -d <DATABASE> -f services/backend/src/utils/migrations/002_add_connect_fields.sql
```

**Verification**:
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calls' 
AND column_name IN ('connect_contact_id', 'recording_status');
```

---

### Step 4: Configure Connect Storage (REQUIRED)

**Location**: AWS Connect Console → Your Instance → Data storage

**Steps**:
1. Navigate to: https://console.aws.amazon.com/connect/
2. Select your Connect instance
3. Go to **Settings** → **Data storage**
4. Under **Call recordings**, click **Edit**
5. Configure:
   - **S3 bucket**: `ai-ca-agent-staging-recordings-us-east-1` (or check Terraform output)
   - **Prefix**: `connect-recordings/`
   - **Encryption**: Use existing KMS key
   - **Enable call recordings**: ✅ Check
6. Click **Save**

**Verification**:
- Storage configuration shows as "Enabled"
- S3 bucket path is correct

---

### Step 5: Claim Phone Number (REQUIRED)

**Location**: AWS Connect Console → Your Instance → Phone numbers

**Steps**:
1. In Connect Console, go to **Phone numbers** → **Claim phone number**
2. Choose:
   - **Country**: Select your country
   - **Type**: Toll-free or Direct Dial
   - **Area code**: Select desired area code
3. Review and claim
4. **Note**: May take 24-48 hours for approval in some regions

**Verification**:
- Phone number appears in "Claimed numbers" list
- Status shows as "Active"

---

### Step 6: Create Outbound Contact Flow (REQUIRED)

**Location**: AWS Connect Console → Your Instance → Contact flows

**Steps**:
1. Go to **Contact flows** → **Create contact flow**
2. Name: `Outbound-Call-Flow`
3. Use the flow template from `infra/terraform/connect-contact-flow.json` OR manually create:
   - **Start**: StartOutboundVoiceContact block
   - **Set Recording**: SetRecordingBehavior block (RecordAll)
   - **End**: Disconnect block
4. Configure StartOutboundVoiceContact:
   - Destination: `$.Attributes.DestinationPhoneNumber`
   - Attributes: Set `LeadId` and `PhoneNumber` from flow attributes
5. Save and **Publish** the flow

**Verification**:
- Flow appears in published flows list
- Flow status is "Published"

---

### Step 7: Verify IAM Role Attachment (VERIFY)

**Location**: AWS Connect Console → Your Instance → Security

**Steps**:
1. Go to **Security** → **Service-linked roles**
2. Verify role `ai-ca-agent-staging-connect-service-role` is listed
3. If not, attach it:
   - Go to IAM Console
   - Find role: `ai-ca-agent-staging-connect-service-role`
   - Copy role ARN
   - In Connect Console → Security → Service-linked roles → Attach role

**Verification**:
- Role appears in Connect security settings
- Role has correct permissions

---

### Step 8: Test End-to-End Flow (RECOMMENDED)

**Location**: Terminal/Command Line

**Steps**:
1. **Get Connect Instance ID**:
   ```bash
   # From Terraform output or AWS Console
   INSTANCE_ID="<your-instance-id>"
   ```

2. **Get Contact Flow ID**:
   ```bash
   aws connect list-contact-flows \
     --instance-id $INSTANCE_ID \
     --region us-east-1 \
     --query "ContactFlowSummaryList[?Name=='Outbound-Call-Flow'].Id" \
     --output text
   ```

3. **Get Phone Number**:
   ```bash
   aws connect list-phone-numbers \
     --instance-id $INSTANCE_ID \
     --region us-east-1 \
     --query "PhoneNumberSummaryList[0].PhoneNumber" \
     --output text
   ```

4. **Test Outbound Call**:
   ```bash
   aws connect start-outbound-voice-contact \
     --instance-id $INSTANCE_ID \
     --contact-flow-id <FLOW_ID> \
     --destination-phone-number "+1234567890" \
     --source-phone-number <YOUR_CONNECT_NUMBER> \
     --attributes '{"LeadId":"test-lead-123","PhoneNumber":"+1234567890"}' \
     --region us-east-1
   ```

5. **Verify Recording**:
   - Check S3 bucket: `ai-ca-agent-staging-recordings-us-east-1/connect-recordings/`
   - Check Lambda logs in CloudWatch
   - Check database `calls` table for new record

**Verification**:
- Call is placed successfully
- Recording appears in S3
- Lambda processes the event
- Database record is created/updated

---

### Step 9: Update Backend API (OPTIONAL - For Testing)

**Location**: Code Editor

**Steps**:
1. Add API endpoint to initiate calls (if needed):
   - Create route: `POST /api/v1/calls/initiate`
   - Use AWS SDK to call `connect.startOutboundVoiceContact()`
   - Store call metadata in database

**Note**: This is optional - you can test via AWS CLI first.

---

## ✅ CHECKLIST - Verify Everything Works

After completing all manual steps, verify:

- [ ] Connect instance exists and is Active
- [ ] Phone number is claimed and Active
- [ ] Storage is configured for recordings
- [ ] Contact flow is created and Published
- [ ] IAM role is attached to Connect
- [ ] Lambda function code is deployed
- [ ] Database migration is complete (calls table has new fields)
- [ ] S3 event notifications are configured
- [ ] Test call can be placed
- [ ] Recording appears in S3
- [ ] Lambda processes S3 event
- [ ] Database record is created/updated

---

## 🚨 TROUBLESHOOTING

### Connect Instance Not Found
- **Solution**: Run `terraform apply` first
- **Check**: IAM role exists: `aws iam get-role --role-name ai-ca-agent-staging-connect-service-role`

### Lambda Function Not Processing Events
- **Check**: Lambda function code is deployed
- **Check**: Lambda has VPC access (for RDS)
- **Check**: Lambda has correct IAM permissions
- **Check**: CloudWatch logs for errors

### Recordings Not Appearing in S3
- **Check**: Storage is configured in Connect Console
- **Check**: S3 bucket policy allows Connect to write
- **Check**: Recording is enabled in contact flow

### Database Records Not Created
- **Check**: Database migration was run
- **Check**: Lambda can connect to RDS (VPC configuration)
- **Check**: DB_SECRET_ARN environment variable is set
- **Check**: CloudWatch logs for database errors

---

## 📝 NOTES

- **Connect instances cannot be stopped** - they're always active (~$0-1/month)
- **Phone numbers cost ~$1/month each** - release them when not needed
- **Recordings are stored in S3** - costs depend on storage size
- **Lambda processes events asynchronously** - may take a few seconds
- **Database updates are idempotent** - safe to retry

---

**All automated tasks are complete. Follow the manual steps above to finish the setup!**

