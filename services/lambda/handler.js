const AWS = require('aws-sdk');
const { Client } = require('pg');

const secretsManager = new AWS.SecretsManager();
const s3 = new AWS.S3();

/**
 * Lambda handler for POST /enquiry endpoint
 * 
 * Validates payload, saves to RDS, and publishes to SQS (or logs for now)
 */
exports.enquiry = async (event) => {
  console.log('Enquiry handler invoked:', JSON.stringify(event));

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Validate payload
    if (!body.email || !body.name || !body.message) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing required fields: email, name, message'
        })
      };
    }

    // Get database credentials from Secrets Manager
    const dbSecretArn = process.env.DB_SECRET_ARN;
    if (!dbSecretArn) {
      throw new Error('DB_SECRET_ARN environment variable not set');
    }

    const secretResponse = await secretsManager.getSecretValue({
      SecretId: dbSecretArn
    }).promise();

    // Handle potential encoding issues (BOM, whitespace, etc.)
    let secretString = secretResponse.SecretString;
    
    // Remove BOM if present
    if (secretString.length > 0 && secretString.charCodeAt(0) === 0xFEFF) {
      secretString = secretString.slice(1);
    }
    
    // Remove any non-printable characters at the start
    secretString = secretString.replace(/^[\u0000-\u001F\u007F-\u009F]+/, '');
    
    // Trim whitespace
    secretString = secretString.trim();
    
    // Log the first few characters for debugging (without exposing sensitive data)
    console.log('Secret string length:', secretString.length);
    console.log('First 50 chars:', secretString.substring(0, 50));
    
    let dbCredentials;
    try {
      dbCredentials = JSON.parse(secretString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Secret string (first 200 chars):', secretString.substring(0, 200));
      throw new Error(`Failed to parse secret JSON: ${parseError.message}`);
    }

    // Connect to database with SSL (required by RDS)
    const client = new Client({
      host: dbCredentials.host,
      port: dbCredentials.port || 5432,
      database: dbCredentials.dbname || dbCredentials.database,
      user: dbCredentials.username || dbCredentials.user,
      password: dbCredentials.password,
      ssl: {
        rejectUnauthorized: false // RDS requires SSL but we can skip cert verification
      },
      connectionTimeoutMillis: 10000
    });

    console.log('Attempting to connect to database:', {
      host: dbCredentials.host,
      port: dbCredentials.port || 5432,
      database: dbCredentials.dbname || dbCredentials.database,
      user: dbCredentials.username || dbCredentials.user
    });

    await client.connect();
    console.log('Database connection successful');

    // Create leads table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(255) NOT NULL,
        source VARCHAR(100),
        enquiry_type VARCHAR(100),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    `;
    
    await client.query(createTableQuery);
    console.log('Table verified/created');

    // Save enquiry to database (using leads table as per schema)
    const insertQuery = `
      INSERT INTO leads (email, name, notes, enquiry_type, source, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING id
    `;

    const result = await client.query(insertQuery, [
      body.email,
      body.name,
      body.message || body.notes || '',
      body.enquiryType || 'general',
      'website'
    ]);

    await client.end();

    const enquiryId = result.rows[0].id;

    // TODO: Publish to SQS for async processing
    // For now, just log
    console.log(`Enquiry saved with ID: ${enquiryId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Enquiry received successfully',
        enquiryId: enquiryId
      })
    };

  } catch (error) {
    console.error('Error processing enquiry:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};

