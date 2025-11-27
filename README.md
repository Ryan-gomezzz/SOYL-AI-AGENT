# SOYL AI Agent - Week 1 Infrastructure Setup

## Project Description

SOYL AI Agent is an AI-powered customer acquisition agent system that handles customer inquiries, manages call recordings, processes transcripts, and provides intelligent responses using LLM capabilities.

## Week 1 Deliverables

### Infrastructure Components
- **VPC & Networking**: VPC with public/private subnets across 2 AZs, Internet Gateway, NAT Gateway
- **RDS PostgreSQL**: Database instance for storing leads, calls, transcripts, and LLM results
- **S3 Buckets**: Three buckets for recordings, transcripts, and static assets
- **ECS Fargate**: Container orchestration for backend services
- **ECR**: Container registry for service images
- **EC2 GPU Instance**: GPU instance for running Ollama LLM service
- **Lambda Functions**: 
  - Enquiry handler (API Gateway integration)
  - Transcribe worker (S3 event processing)
  - Connect handler (deprecated, kept for compatibility)
- **API Gateway**: HTTP API for Lambda functions and webhooks
- **SES**: Email service for sending confirmation emails
- **IAM Roles**: Least-privilege roles for Lambda, ECS, and other services

### Service Skeletons
- **Backend Service**: Node.js Express/Fastify API service
- **Worker Service**: Background job processor
- **Lambda Function**: Serverless enquiry handler
- **Frontend**: React + Tailwind CSS application

### Documentation
- Architecture documentation with data model and call flow
- Deployment steps and manual procedures
- Terraform plan outputs for review

## Getting Started

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform >= 1.0
- Node.js >= 18
- Docker & Docker Compose
- Git

### Setup Instructions

1. **Review Terraform Plan**
   ```bash
   cd infra/terraform
   terraform init
   terraform plan
   ```

2. **Build Lambda Function Packages**
   ```bash
   # Build enquiry handler
   cd services/lambda
   npm install --production
   # Create zip file (see deploy-steps.md for platform-specific commands)
   
   # Build transcribe worker
   cd services/worker
   npm install --production
   # Use build script (see deploy-steps.md)
   ```

3. **Add SES DNS Records**
   - Review `infra/terraform/plans/week1_plan.txt` for SES DNS TXT record details
   - Add the TXT record to your domain DNS settings
   - Wait for AWS SES domain verification (up to 24 hours)

4. **Apply Infrastructure** (after review and SES verification)
   ```bash
   cd infra/terraform
   terraform apply
   ```

5. **Build and Push Backend Image**
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <ecr-repo-url>
   docker build -t <ecr-repo-url>:latest services/backend
   docker push <ecr-repo-url>:latest
   ```

6. **Run Local Development**
   ```bash
   scripts/run-local.sh
   ```

7. **Telephony Setup (Twilio)**
   - Create a Twilio account and buy a phone number
   - Add `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` to your pipeline/Secrets
   - Deploy the webhook Lambda with `npm run deploy:lambda` (or the provided GH Action)
   - Run `scripts/twilio/provision_webhook.sh` to set the Twilio phone number webhook to `https://<YOUR-API>/twilio/webhook`
   - Use the included test scripts to simulate inbound events

## Project Structure

```
.
├── infra/
│   └── terraform/          # Terraform infrastructure code
│       ├── main.tf
│       ├── providers.tf
│       ├── variables.tf
│       ├── vpc.tf
│       ├── rds.tf
│       ├── s3.tf
│       ├── iam.tf
│       ├── ecs.tf
│       ├── ecr.tf
│       ├── ec2.tf
│       ├── ses.tf
│       ├── lambda.tf
│       ├── outputs.tf
│       └── plans/           # Terraform plan outputs
├── services/
│   ├── backend/            # Backend API service
│   ├── worker/             # Background worker service
│   └── lambda/             # Lambda function handlers
├── frontend/               # React frontend application
├── scripts/                # Utility scripts
└── docs/                   # Documentation

```

## Environment Variables

Required environment variables (set before running Terraform):
- `AWS_PROFILE`: AWS CLI profile name
- `AWS_REGION`: AWS region for deployment
- `PROJECT`: Project name (default: "ai-ca-agent")
- `ENVIRONMENT`: Environment name (default: "staging")
- `SSH_KEY_NAME`: EC2 keypair name for SSH access
- `ADMIN_EMAIL`: Admin email for SES verification
- `DOMAIN`: Domain name for SES verification

## Security Notes

- **Bastion Security Group**: Currently allows SSH from 0.0.0.0/0. **MUST be locked down** to specific IP ranges in production.
- **RDS Credentials**: Stored in AWS Secrets Manager, not in Terraform variables.
- **S3 Buckets**: All buckets have public access blocked and use SSE-KMS encryption.
- **IAM Policies**: Follow least-privilege principle. Review and tighten policies as needed.

## Next Steps

1. Review the Terraform plan in `infra/terraform/plans/week1_plan.txt`
2. Add SES DNS TXT record to domain
3. After SES verification, review and approve Terraform apply
4. Build and deploy backend service to ECR
5. Configure ECS service with task definition
6. Set up CI/CD pipeline for automated deployments

## Support

For issues or questions, please create an issue in the repository or contact the team.

