# Deployment Checklist

## Pre-Deployment Steps

### 1. Git Commit Changes
- [ ] Stage all changes
- [ ] Commit with descriptive message
- [ ] (Optional) Push to remote

### 2. Build & Test Locally
- [ ] Backend builds without errors
- [ ] Frontend builds without errors
- [ ] No linting errors

### 3. Deploy Backend to ECS
- [ ] Authenticate Docker to ECR
- [ ] Build Docker image
- [ ] Tag and push to ECR
- [ ] Update ECS service
- [ ] Wait for service to stabilize

### 4. Run Database Migrations
- [ ] Migrations run successfully
- [ ] Verify database schema

### 5. Update Frontend Configuration
- [ ] Create .env file with API Gateway URL
- [ ] Test frontend connection to deployed backend

### 6. Test Deployed Services
- [ ] Health check endpoint
- [ ] Enquiry endpoint
- [ ] Leads endpoint
- [ ] Frontend dashboard
- [ ] Email sending (if SES configured)

## Post-Deployment

- [ ] Monitor logs
- [ ] Verify all endpoints working
- [ ] Test end-to-end flow
- [ ] Document any issues

