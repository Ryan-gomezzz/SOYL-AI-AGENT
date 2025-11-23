# Starting Backend Locally (Without Database)

## Quick Start (Without Database Connection)

For local development when RDS is not accessible:

```powershell
cd services/backend

# Set environment variables
$env:ALLOW_DB_FAILURE = "true"
$env:NODE_ENV = "development"
$env:PORT = "3000"
$env:DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:381492072674:secret:ai-ca-agent-staging-rds-credentials-qgFKkX"
$env:AWS_REGION = "us-east-1"

# Start server
npm run dev
```

The server will start even if the database connection fails. This is useful for:
- Testing the frontend locally
- Developing UI without database access
- Testing API endpoints that don't require database

## Note

With `ALLOW_DB_FAILURE=true`:
- ✅ Server will start
- ✅ Health check endpoint will work
- ✅ Frontend can connect to backend
- ❌ Database-dependent endpoints will fail (e.g., `/api/v1/leads`, `/api/v1/enquiry`)

## Testing Frontend Connection

Once backend is running (even without database):
1. Open browser to `http://localhost:5173`
2. Frontend will connect to backend
3. Some features won't work without database, but UI will load

## Production/Deployment

For production, do NOT set `ALLOW_DB_FAILURE=true`. The backend will require a valid database connection.

