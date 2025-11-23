# Starting the Frontend Dev Server

## Quick Start

Open a terminal in the `frontend` directory and run:

```bash
npm run dev
```

## Expected Output

You should see output similar to:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

## Accessing the Application

Once the server starts, open your browser and go to:

**http://localhost:5173**

## API Configuration

The frontend is configured to connect to:
- **Default (local):** `http://localhost:3000`
- **Production:** `https://px9q707kr6.execute-api.us-east-1.amazonaws.com`

To change the API URL, create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:3000
```

Or for production:

```env
VITE_API_URL=https://px9q707kr6.execute-api.us-east-1.amazonaws.com
```

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port (5174, 5175, etc.). Check the terminal output for the actual port number.

### Cannot Connect to Backend

1. Make sure the backend is running on `http://localhost:3000`
2. Or update the `.env` file to point to your deployed API Gateway URL
3. Check browser console for CORS errors

### Dependencies Not Installed

Run:
```bash
npm install
```

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

