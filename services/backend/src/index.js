/**
 * Backend API Service
 * 
 * Production-ready Express.js application with:
 * - Database connection pooling
 * - Request validation
 * - Error handling
 * - Health checks
 * - Graceful shutdown
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
let server = null;

// Import routes and database
const enquiryRoutes = require('./routes/enquiry');
const leadsRoutes = require('./routes/leads');
const callsRoutes = require('./routes/calls');
const transcriptsRoutes = require('./routes/transcripts');
const { initializePool, query } = require('./config/database');
const { runMigrations } = require('./utils/migrate');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (production-ready)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoint with database connectivity check
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backend',
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Check database connectivity
    try {
      await query('SELECT 1');
      health.database = 'connected';
    } catch (dbError) {
      health.database = 'disconnected';
      health.error = dbError.message;
    }

    const statusCode = health.database === 'connected' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Service status endpoint
app.get('/api/v1/status', (req, res) => {
  res.json({
    service: 'backend',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1', enquiryRoutes);
app.use('/api/v1', leadsRoutes);
app.use('/api/v1', callsRoutes);
app.use('/api/v1', transcriptsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Initialize application
async function startServer() {
  try {
    // Initialize database connection pool
    console.log('Initializing database connection...');
    try {
      await initializePool();
    } catch (dbError) {
      // In development, allow server to start even if DB connection fails
      if (process.env.NODE_ENV === 'development' || process.env.ALLOW_DB_FAILURE === 'true') {
        console.warn('⚠️  Database initialization failed, but continuing in development mode');
        console.warn(`   Error: ${dbError.message}`);
        console.warn('   Note: Database-dependent endpoints will not work');
        console.warn('   This is OK for local development/testing frontend');
        console.warn('   Set ALLOW_DB_FAILURE=true to explicitly allow this');
      } else {
        // In production, fail if database connection fails
        console.error('❌ Database connection is required in production');
        throw dbError;
      }
    }

    // Run database migrations (skip in production if migrations are run separately)
    if (process.env.RUN_MIGRATIONS !== 'false') {
      console.log('Running database migrations...');
      try {
        await runMigrations();
      } catch (migrationError) {
        console.error('Migration error (non-fatal):', migrationError.message);
        // Don't exit - migrations might be run separately
      }
    }

    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log('✅ Backend service started successfully');
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
      console.log(`   API endpoint: http://localhost:${PORT}/api/v1`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        throw error;
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;

