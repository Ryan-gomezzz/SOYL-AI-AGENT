/**
 * Database Configuration for Worker Service
 * 
 * Reuses the same database configuration pattern as backend service
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

// Connection pool
let pool = null;
let isInitializing = false;
let initPromise = null;

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch database credentials from AWS Secrets Manager
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
    
    if (!credentials.host && !credentials.endpoint) {
      throw new Error('Database host/endpoint not found in secret');
    }
    
    if (!credentials.username && !credentials.user) {
      throw new Error('Database username not found in secret');
    }
    
    if (!credentials.password) {
      throw new Error('Database password not found in secret');
    }

    return {
      host: credentials.host || credentials.endpoint,
      port: parseInt(credentials.port || '5432', 10),
      database: credentials.dbname || credentials.database || credentials.dbName,
      user: credentials.username || credentials.user,
      password: credentials.password,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false }
        : false
    };
  } catch (error) {
    if (retries < MAX_RETRIES && (
      error.code === 'ThrottlingException' ||
      error.code === 'ServiceUnavailableException' ||
      error.statusCode === 500 ||
      error.statusCode === 503
    )) {
      const delay = RETRY_DELAY * Math.pow(2, retries);
      console.warn(`⚠️  Secrets Manager request failed, retrying in ${delay}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return getDatabaseCredentials(retries + 1);
    }
    
    console.error('Error fetching database credentials from Secrets Manager:', error);
    throw new Error(`Failed to fetch database credentials: ${error.message}`);
  }
}

/**
 * Initialize database connection pool
 */
async function initializePool() {
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
      
      pool = new Pool({
        ...config,
        max: 5,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      });

      pool.on('error', (err) => {
        console.error('⚠️  Unexpected error on idle database client:', err);
      });

      // Test connection
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection pool initialized successfully');
      isInitializing = false;
      return pool;
    } catch (error) {
      isInitializing = false;
      console.error('❌ Failed to initialize database connection pool:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Get database connection pool
 */
async function getPool() {
  if (!pool) {
    await initializePool();
  }
  return pool;
}

/**
 * Execute a database query
 */
async function query(text, params = []) {
  const dbPool = await getPool();
  return dbPool.query(text, params);
}

/**
 * Close database connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    isInitializing = false;
    initPromise = null;
  }
}

module.exports = {
  getPool,
  query,
  initializePool,
  closePool
};

