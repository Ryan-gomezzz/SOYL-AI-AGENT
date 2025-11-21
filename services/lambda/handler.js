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

    const dbCredentials = JSON.parse(secretResponse.SecretString);

    // Connect to database
    const client = new Client({
      host: dbCredentials.host,
      port: dbCredentials.port,
      database: dbCredentials.dbname,
      user: dbCredentials.username,
      password: dbCredentials.password
    });

    await client.connect();

    // Save enquiry to database
    const insertQuery = `
      INSERT INTO enquiries (email, name, message, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id
    `;

    const result = await client.query(insertQuery, [
      body.email,
      body.name,
      body.message
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

