# Backend Connection Status

## Current Status

**Frontend:** ✅ Running on `http://localhost:5173`  
**Backend:** ❌ NOT running on `http://localhost:3000`  
**Connection:** ❌ NOT CONNECTED

## Problem

The frontend is configured to connect to `http://localhost:3000` by default, but the backend is not running locally.

## Solutions

### Option 1: Start Backend Locally (Recommended for Development)

1. **Start the backend service:**

```powershell
cd services/backend
npm install
npm run dev
```

2. **Verify backend is running:**

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

3. **Frontend will automatically connect** once backend is running.

---

### Option 2: Connect to Deployed API Gateway (For Testing Deployed Backend)

1. **Create `.env` file in `frontend` directory:**

```powershell
cd frontend
@"
VITE_API_URL=https://px9q707kr6.execute-api.us-east-1.amazonaws.com
"@ | Out-File -FilePath .env -Encoding utf8
```

2. **Restart the frontend dev server:**

```powershell
# Stop current server (Ctrl+C)
npm run dev
```

3. **Frontend will now connect to deployed API Gateway.**

---

### Option 3: Deploy Backend to ECS (For Production)

Follow the deployment guide:
- `docs/STEP_BY_STEP_WEEK1_DEPLOYMENT.md` - Task 3: Deploy to ECS

---

## Verify Connection

Once backend is running, test the connection:

### Test Health Endpoint

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/health"
```

### Test Leads API

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/leads"
```

### Test Enquiry API

```powershell
$body = @{
    name = "Test User"
    email = "test@example.com"
    phone = "+1234567890"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/v1/enquiry" -Method POST -Body $body -ContentType "application/json"
```

---

## Frontend Configuration

The frontend API client (`frontend/src/api/leads.js`) is configured to:

1. **Check for environment variable:** `VITE_API_URL`
2. **Fallback to default:** `http://localhost:3000`

To change the API URL, create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:3000
```

Or for deployed API:

```env
VITE_API_URL=https://px9q707kr6.execute-api.us-east-1.amazonaws.com
```

---

## Next Steps

1. **Start backend locally** (Option 1) - Best for development
2. **Or** configure frontend to use deployed API (Option 2) - Best for testing deployed services
3. **Verify connection** using the test commands above

---

**Status:** Frontend is ready, waiting for backend connection.

