# Starting Backend Server

## Quick Start

Open a terminal in the `services/backend` directory and run:

```powershell
# Set environment variables
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$env:AWS_REGION = "us-east-1"
$env:NODE_ENV = "development"
$env:PORT = "3000"

# Start server
npm run dev
```

Or using node directly:

```powershell
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$env:AWS_REGION = "us-east-1"
$env:NODE_ENV = "development"
$env:PORT = "3000"
node src/index.js
```

## Prerequisites

1. **AWS CLI configured** - Backend needs AWS credentials to access Secrets Manager
2. **Database accessible** - RDS must be accessible (may need VPN/bastion if in private subnet)
3. **Dependencies installed** - Run `npm install` first

## Verify Backend is Running

After starting, you should see output like:

```
Initializing database connection...
Database connection pool initialized successfully
✅ Backend service started successfully
   Environment: development
   Port: 3000
   Health check: http://localhost:3000/health
   API endpoint: http://localhost:3000/api/v1
```

## Test Connection

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "backend",
  "database": "connected"
}
```

## Troubleshooting

### Database Connection Failed

If you see "Database connection error", check:
- AWS credentials are configured
- DB_SECRET_ARN is correct
- RDS security group allows connections
- Database is accessible from your network

### Port 3000 Already in Use

```powershell
# Check what's using port 3000
Get-NetTCPConnection -LocalPort 3000

# Or use a different port
$env:PORT = "3001"
npm run dev
```

### Missing Dependencies

```powershell
npm install
```

## Note

If running locally, the backend needs:
- AWS credentials (for Secrets Manager)
- Network access to RDS (may need VPN or bastion host)

For easier local development, you could also:
- Use local PostgreSQL instead of RDS
- Set DB credentials directly via environment variables (bypass Secrets Manager)

