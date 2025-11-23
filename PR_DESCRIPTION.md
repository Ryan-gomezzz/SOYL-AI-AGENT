# Complete Deployment Fixes and Node.js 20 Upgrade

## Reference-Sections: reference/README.md -> WEEK 1 — FOUNDATIONS & CORE PIPELINE (Engineer A)

## Overview

This PR completes the Week 1 infrastructure deployment by fixing Lambda function issues, configuring VPC access for RDS, and upgrading to Node.js 20 runtime as required by AWS.

## Changes

### Infrastructure Updates
- ✅ Upgraded Lambda runtime from Node.js 18 to Node.js 20 (AWS requirement)
- ✅ Configured Lambda VPC access for RDS connectivity
- ✅ Added Lambda security group and updated RDS security group rules
- ✅ Updated IAM roles with VPC access permissions
- ✅ Updated Terraform configuration for Node.js 20

### Lambda Function Fixes
- ✅ Fixed dependency packaging and deployment
- ✅ Added SSL configuration for RDS PostgreSQL connection
- ✅ Implemented table creation/verification logic
- ✅ Fixed secret parsing with encoding handling (BOM, whitespace)
- ✅ Improved error handling and logging
- ✅ Updated handler to use correct database schema (leads table)

### Testing & Verification
- ✅ API Gateway endpoint fully functional
- ✅ Lambda → RDS connection successful
- ✅ Enquiries successfully saved to database
- ✅ All deployment issues resolved

### Documentation
- ✅ Added comprehensive deployment status documentation
- ✅ Added Lambda VPC configuration guide
- ✅ Added Node.js upgrade documentation
- ✅ Cleaned up outdated Week 1 status reports

## Testing Results

- **API Gateway Endpoint**: `https://px9q707kr6.execute-api.us-east-1.amazonaws.com/staging/enquiry`
- **Status**: ✅ Fully Working
- **Test Enquiry IDs**: 
  - `66cefea5-0aa0-4e58-95a0-282b26745d02`
  - `85ee4fbe-50a6-458b-92fc-a46d4f324a68`
  - `c44f8603-c582-4e88-8c61-23469206111d`
  - `60f7a921-fd16-42b9-9044-ccb2c3169459`

## Files Changed

### Infrastructure
- `infra/terraform/lambda.tf` - Node.js 20 runtime, VPC config
- `infra/terraform/vpc.tf` - Lambda security group
- `infra/terraform/iam.tf` - VPC access policy
- `infra/terraform/outputs.tf` - Lambda SG output

### Lambda Function
- `services/lambda/handler.js` - SSL, table creation, error handling
- `services/lambda/package-lock.json` - Dependencies

### Documentation
- `docs/DEPLOYMENT_STATUS.md` - Current deployment status
- `docs/LAMBDA_VPC_CONFIGURATION_COMPLETE.md` - VPC setup guide
- `docs/NODEJS_UPGRADE.md` - Node.js 20 upgrade details
- Removed 16 outdated documentation files

## Deployment Status

✅ **All Week 1 infrastructure components deployed and tested**
✅ **Lambda function fully functional**
✅ **API Gateway endpoint operational**
✅ **Database connectivity verified**

## Related Sections

- **reference/README.md -> WEEK 1 — FOUNDATIONS & CORE PIPELINE**
  - Engineer A tasks: IAM, VPC, subnets; RDS Postgres; Lambda; API Gateway; ECS Fargate
- **reference/README.md -> Developer conventions**
  - Backend: Node 18 (upgraded to Node 20 per AWS requirement)
  - Secrets: AWS Secrets Manager only

