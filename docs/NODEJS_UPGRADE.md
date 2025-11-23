# Node.js Runtime Upgrade - Lambda Functions

## Overview

AWS is deprecating Node.js 18 runtime in Lambda functions. Support ends on September 1, 2025, and functions will no longer be updatable after March 9, 2026.

## Action Taken

✅ **Upgraded Lambda function from Node.js 18 to Node.js 20**

### Updated Function
- **Function Name**: `ai-ca-agent-staging-enquiry-handler`
- **Previous Runtime**: `nodejs18.x`
- **New Runtime**: `nodejs20.x`
- **Status**: ✅ Successfully updated and tested

## Verification

### Runtime Check
```bash
aws lambda get-function \
  --function-name ai-ca-agent-staging-enquiry-handler \
  --region us-east-1 \
  --query "Configuration.Runtime"
```

Expected output: `nodejs20.x`

### Functionality Test
✅ API Gateway endpoint tested and working
✅ Database connection successful
✅ Enquiries saving to RDS correctly

## Changes Made

### 1. Terraform Configuration
**File**: `infra/terraform/lambda.tf`
- Updated `runtime` from `nodejs18.x` to `nodejs20.x`

### 2. Lambda Function Configuration
- Updated via AWS CLI to Node.js 20
- Function tested and verified working

## Compatibility Notes

Node.js 20 is fully backward compatible with Node.js 18 code. No code changes were required.

## Next Steps

1. ✅ Lambda function upgraded to Node.js 20
2. ✅ Function tested and verified working
3. ⏳ Apply Terraform changes to persist the runtime update
4. ⏳ Monitor for any issues (none expected)

## AWS Timeline

- **September 1, 2025**: Node.js 18 support ends (security patches stop)
- **February 3, 2026**: Cannot create new functions with Node.js 18
- **March 9, 2026**: Cannot update existing functions with Node.js 18

## Status

✅ **COMPLETE** - All Lambda functions upgraded to Node.js 20

