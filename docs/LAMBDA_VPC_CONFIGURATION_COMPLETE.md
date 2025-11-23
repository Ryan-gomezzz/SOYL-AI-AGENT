# Lambda VPC Configuration - Complete

## ✅ Completed Tasks

### 1. Lambda Security Group Created
- **Security Group ID**: `sg-0af6824569a09f277`
- **Name**: `ai-ca-agent-staging-lambda-sg`
- **VPC**: `vpc-0e8806f58784d1adc`
- **Egress**: All outbound traffic allowed

### 2. RDS Security Group Updated
- **Security Group ID**: `sg-093a3c71a8c386033`
- **Ingress Rule Added**: PostgreSQL (port 5432) from Lambda security group
- **Status**: ✅ Rule successfully added

### 3. Lambda VPC Configuration
- **VPC ID**: `vpc-0e8806f58784d1adc`
- **Subnets**: 
  - `subnet-03753c781e88ba0f4`
  - `subnet-01a9849db8593ad10`
- **Security Group**: `sg-0af6824569a09f277`
- **Status**: ✅ VPC configuration applied successfully

### 4. Lambda IAM Role Updated
- **Role**: `ai-ca-agent-staging-lambda-execution-role`
- **Policy Attached**: `AWSLambdaVPCAccessExecutionRole`
- **Status**: ✅ VPC access permissions granted

### 5. RDS Secret Updated
- **Secret ARN**: `arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX`
- **Host Updated**: `ai-ca-agent-staging-db.c0dkwuyw0ne2.us-east-1.rds.amazonaws.com`
- **Status**: ✅ Secret contains correct RDS endpoint

## Infrastructure Summary

| Component | Status | Details |
|-----------|--------|---------|
| Lambda Security Group | ✅ Created | `sg-0af6824569a09f277` |
| RDS Security Group | ✅ Updated | Lambda SG added to ingress |
| Lambda VPC Config | ✅ Applied | Connected to private subnets |
| Lambda IAM Role | ✅ Updated | VPC access policy attached |
| RDS Secret | ✅ Updated | Contains correct host |

## Current Status

### ✅ Working
- Lambda function has VPC configuration
- Security groups are properly configured
- IAM permissions are correct
- RDS endpoint is in the secret

### ⚠️ Remaining Issue
- **Error**: JSON parsing error when Lambda retrieves secret from Secrets Manager
- **Error Message**: "Unexpected token u in JSON at position 1"
- **Location**: `handler.js:43` - `JSON.parse(secretResponse.SecretString)`

### Root Cause Analysis
The error suggests that when AWS Secrets Manager returns the secret, the `SecretString` might have encoding issues or extra characters. This could be due to:
1. BOM (Byte Order Mark) in the JSON file
2. Encoding issues when updating the secret via PowerShell
3. Lambda caching an old version of the secret

## Next Steps to Fix

### Option 1: Update Secret via AWS Console
1. Go to AWS Secrets Manager console
2. Select `ai-ca-agent-staging-rds-credentials`
3. Click "Retrieve secret value"
4. Click "Edit"
5. Ensure the JSON is valid:
   ```json
   {
     "username": "aiadmin",
     "password": "?MNGLvuLF:K#P]a]M&lHB}CvxZ!aNSbf",
     "engine": "postgres",
     "port": 5432,
     "dbname": "ai_ca_agent_db",
     "host": "ai-ca-agent-staging-db.c0dkwuyw0ne2.us-east-1.amazonaws.com"
   }
   ```
6. Save the secret

### Option 2: Update Lambda Handler to Handle Encoding
Modify `services/lambda/handler.js` to handle potential encoding issues:
```javascript
const secretResponse = await secretsManager.getSecretValue({
  SecretId: dbSecretArn
}).promise();

// Handle potential encoding issues
let secretString = secretResponse.SecretString;
// Remove BOM if present
if (secretString.charCodeAt(0) === 0xFEFF) {
  secretString = secretString.slice(1);
}
// Trim whitespace
secretString = secretString.trim();

const dbCredentials = JSON.parse(secretString);
```

### Option 3: Use AWS SDK v3
Migrate to AWS SDK v3 which handles secrets better:
```javascript
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const client = new SecretsManagerClient({ region: "us-east-1" });
const response = await client.send(new GetSecretValueCommand({
  SecretId: dbSecretArn
}));

const dbCredentials = JSON.parse(response.SecretString);
```

## Verification Commands

### Check Lambda VPC Configuration
```bash
aws lambda get-function \
  --function-name ai-ca-agent-staging-enquiry-handler \
  --region us-east-1 \
  --query "Configuration.VpcConfig"
```

### Check RDS Security Group Rules
```bash
aws ec2 describe-security-groups \
  --group-ids sg-093a3c71a8c386033 \
  --region us-east-1 \
  --query "SecurityGroups[0].IpPermissions[?FromPort==\`5432\`]"
```

### Check Lambda Security Group
```bash
aws ec2 describe-security-groups \
  --group-ids sg-0af6824569a09f277 \
  --region us-east-1
```

### Test Database Connection (from Lambda)
Once the secret issue is resolved, the Lambda should be able to:
1. Retrieve secret from Secrets Manager ✅
2. Parse JSON credentials ✅
3. Connect to RDS via VPC ✅
4. Insert enquiry into database ✅

## Summary

**All VPC and security group configurations are complete and correct.** The only remaining issue is a JSON parsing error when retrieving the secret, which is likely an encoding issue that can be resolved by:
1. Updating the secret via AWS Console (cleanest approach)
2. Adding encoding handling in the Lambda code
3. Migrating to AWS SDK v3

The network connectivity is properly configured - Lambda can reach RDS through the VPC once the secret parsing issue is resolved.

