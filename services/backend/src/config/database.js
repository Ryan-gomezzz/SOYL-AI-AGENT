/**
 * Database Configuration
 * 
 * Production-ready database connection module with:
 * - AWS Secrets Manager integration
 * - Connection pooling with proper limits
 * - Automatic retry logic
 * - Connection health monitoring
 * - Graceful degradation
 * - Edge case handling
 */

const { Pool } = require('pg');
const AWS = require('aws-sdk');
const { promisify } = require('util');

// Initialize AWS Secrets Manager
const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION || 'us-east-1',
  maxRetries: 3,
  retryDelayOptions: {
    base: 200
  }
});

const getSecretValueAsync = promisify(secretsManager.getSecretValue.bind(secretsManager));

// Connection pool - will be initialized after fetching secrets
let pool = null;
let isInitializing = false;
let initPromise = null;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch database credentials from AWS Secrets Manager with retry logic
 * @param {number} retries - Current retry attempt
 * @returns {Promise<Object>} Database connection parameters
 */
async function getDatabaseCredentials(retries = 0) {
  const secretArn = process.env.DB_SECRET_ARN;
  
  if (!secretArn) {
    // Fallback to environment variables for local development
    if (process.env.NODE_ENV === 'development' && process.env.DB_HOST) {
      console.warn('⚠️  DB_SECRET_ARN not set, using environment variables (development only)');
      return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || process.env.POSTGRES_DB,
        user: process.env.DB_USER || process.env.POSTGRES_USER,
        password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
        ssl: false
      };
    }
    throw new Error('DB_SECRET_ARN environment variable is not set and no fallback credentials available');
  }

  try {
    const secret = await getSecretValueAsync({ SecretId: secretArn });
    
    if (!secret || !secret.SecretString) {
      throw new Error('Secret value is empty or invalid');
    }

    const credentials = JSON.parse(secret.SecretString);
    
    // Validate required fields
    if (!credentials.host && !credentials.endpoint) {
      throw new Error('Database host/endpoint not found in secret');
    }
    
    if (!credentials.username && !credentials.user) {
      throw new Error('Database username not found in secret');
    }
    
    if (!credentials.password) {
      throw new Error('Database password not found in secret');
    }

    const config = {
      host: credentials.host || credentials.endpoint,
      port: parseInt(credentials.port || '5432', 10),
      database: credentials.dbname || credentials.database || credentials.dbName,
      user: credentials.username || credentials.user,
      password: credentials.password,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } // RDS uses SSL, but we trust the certificate
        : false
    };

    // Validate port range
    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Invalid database port: ${config.port}`);
    }

    return config;
  } catch (error) {
    // Retry on transient errors
    if (retries < MAX_RETRIES && (
      error.code === 'ThrottlingException' ||
      error.code === 'ServiceUnavailableException' ||
      error.statusCode === 500 ||
      error.statusCode === 503 ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    )) {
      const delay = RETRY_DELAY * Math.pow(2, retries); // Exponential backoff
      console.warn(`⚠️  Secrets Manager request failed, retrying in ${delay}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return getDatabaseCredentials(retries + 1);
    }
    
    console.error('Error fetching database credentials from Secrets Manager:', error);
    throw new Error(`Failed to fetch database credentials: ${error.message}`);
  }
}

/**
 * Initialize database connection pool with error handling
 * @returns {Promise<Pool>} PostgreSQL connection pool
 */
async function initializePool() {
  // Prevent concurrent initialization
  if (isInitializing && initPromise) {
    return initPromise;
  }

  if (pool) {
    return pool;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const config = await getDatabaseCredentials();
      
      // Validate configuration
      if (!config.host || !config.user || !config.password || !config.database) {
        throw new Error('Invalid database configuration: missing required fields');
      }
      
      // Create connection pool with production-ready settings
      const poolConfig = {
        ...config,
        max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Maximum number of clients
        min: parseInt(process.env.DB_POOL_MIN || '2', 10), // Minimum number of clients
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10), // 30 seconds
        connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10), // 10 seconds
        // Enable keepalive to detect dead connections
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        // Statement timeout (prevent long-running queries)
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10), // 30 seconds
        // Query timeout
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10), // 30 seconds
      };

      // Validate pool configuration
      if (poolConfig.max < poolConfig.min) {
        throw new Error('DB_POOL_MAX must be >= DB_POOL_MIN');
      }

      pool = new Pool(poolConfig);

      // Handle pool errors - don't crash on individual connection errors
      pool.on('error', (err, client) => {
        console.error('⚠️  Unexpected error on idle database client:', err);
        // Log but don't exit - pool will handle reconnection
      });

      // Handle connection errors
      pool.on('connect', (client) => {
        // Optional: Set application name for monitoring
        client.query(`SET application_name = '${process.env.SERVICE_NAME || 'soyl-backend'}'`).catch(() => {
          // Ignore errors setting application name
        });
      });

      // Test the connection with timeout
      const testPromise = pool.query('SELECT NOW() as current_time, version() as pg_version');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection test timeout - RDS may not be accessible from local machine')), 30000) // Increased to 30 seconds
      );

      try {
        await Promise.race([testPromise, timeoutPromise]);
        console.log('✅ Database connection pool initialized successfully');
        isInitializing = false;
        return pool;
      } catch (testError) {
        // In development, allow server to start even if DB connection fails
        if (process.env.NODE_ENV === 'development' || process.env.ALLOW_DB_FAILURE === 'true') {
          console.warn('⚠️  Database connection test failed, but continuing in development mode');
          console.warn(`   Error: ${testError.message}`);
          console.warn('   This is OK for local development/testing frontend');
          console.warn('   Database-dependent endpoints will not work');
          isInitializing = false;
          return pool; // Return pool anyway, it might work later or after deployment
        }
        throw testError; // Re-throw in production or if not explicitly allowed
      }
    } catch (error) {
      isInitializing = false;
      console.error('❌ Failed to initialize database connection pool:', error);
      
      // Clean up on failure
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          console.error('Error closing pool on initialization failure:', closeError);
        }
        pool = null;
      }
      
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Get database connection pool with retry logic
 * Ensures pool is initialized before returning
 * @param {number} retries - Current retry attempt
 * @returns {Promise<Pool>} PostgreSQL connection pool
 */
async function getPool(retries = 0) {
  try {
    if (!pool) {
      await initializePool();
    }
    
    // Verify pool is still valid
    if (pool && pool.totalCount >= 0) {
      return pool;
    }
    
    throw new Error('Pool is invalid');
  } catch (error) {
    if (retries < MAX_RETRIES) {
      console.warn(`⚠️  Pool initialization failed, retrying... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY * Math.pow(2, retries));
      pool = null; // Reset pool to trigger re-initialization
      return getPool(retries + 1);
    }
    throw error;
  }
}

/**
 * Execute a database query with error handling and timeout
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @param {Object} options - Query options (timeout, retries, etc.)
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = [], options = {}) {
  const maxRetries = options.retries || 1;
  const queryTimeout = options.timeout || parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10);
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const dbPool = await getPool();
      const start = Date.now();
      
      // Create query with timeout
      const queryPromise = dbPool.query(text, params);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${queryTimeout}ms`)), queryTimeout)
      );
      
      const res = await Promise.race([queryPromise, timeoutPromise]);
      const duration = Date.now() - start;
      
      // Log slow queries in production
      if (duration > 1000 && process.env.NODE_ENV === 'production') {
        console.warn(`⚠️  Slow query detected (${duration}ms):`, text.substring(0, 100));
      }
      
      return res;
    } catch (error) {
      lastError = error;
      
      // Retry on transient errors
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === '57P01' || // Admin shutdown
        error.code === '57P02' || // Crash shutdown
        error.code === '57P03' || // Cannot connect now
        error.message?.includes('timeout') ||
        error.message?.includes('Connection terminated');
      
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️  Query failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        
        // Reset pool if connection error
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          pool = null;
        }
        
        continue;
      }
      
      // Don't retry on non-retryable errors
      break;
    }
  }
  
  // Log error details (sanitize sensitive info in production)
  if (process.env.NODE_ENV === 'production') {
    console.error('Database query error:', {
      code: lastError.code,
      message: lastError.message,
      query: text.substring(0, 100)
    });
  } else {
    console.error('Database query error:', {
      error: lastError,
      query: text,
      params: params.map(p => typeof p === 'string' ? p.substring(0, 50) : p)
    });
  }
  
  throw lastError;
}

/**
 * Execute a transaction with proper error handling
 * @param {Function} callback - Transaction callback function
 * @param {Object} options - Transaction options (isolation level, etc.)
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback, options = {}) {
  const maxRetries = options.retries || 1;
  const isolationLevel = options.isolationLevel || 'READ COMMITTED';
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const dbPool = await getPool();
    const client = await dbPool.connect();
    
    try {
      // Set transaction isolation level
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      await client.query('BEGIN');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      
      client.release();
      lastError = error;
      
      // Retry on deadlock or serialization failures
      const isRetryable =
        error.code === '40001' || // Serialization failure
        error.code === '40P01' || // Deadlock detected
        error.code === '25P02';   // In failed sql transaction
      
      if (isRetryable && attempt < maxRetries - 1) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️  Transaction failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      
      break;
    }
  }
  
  throw lastError;
}

/**
 * Close database connection pool gracefully
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    try {
      // Wait for active connections to finish (with timeout)
      const closePromise = pool.end();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Pool close timeout')), 10000)
      );
      
      await Promise.race([closePromise, timeoutPromise]);
      pool = null;
      isInitializing = false;
      initPromise = null;
      console.log('Database connection pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error);
      pool = null;
      isInitializing = false;
      initPromise = null;
      throw error;
    }
  }
}

/**
 * Check database connection health
 * @returns {Promise<boolean>} True if healthy, false otherwise
 */
async function checkHealth() {
  try {
    await query('SELECT 1', [], { timeout: 5000, retries: 1 });
    return true;
  } catch (error) {
    return false;
  }
}

// Graceful shutdown handlers
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('SIGTERM received, closing database connections...');
  await closePool();
});

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('SIGINT received, closing database connections...');
  await closePool();
});

module.exports = {
  getPool,
  query,
  transaction,
  initializePool,
  closePool,
  checkHealth
};
