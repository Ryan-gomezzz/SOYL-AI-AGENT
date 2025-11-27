/**
 * DEPRECATED: Lambda Handler for Amazon Connect Events
 * 
 * This handler is deprecated. Amazon Connect was replaced by Twilio Voice
 * due to AISPL account restrictions.
 * 
 * New handler location: infra/lambda/twilio-webhook/handler.js
 * 
 * This file is kept for reference only and should not be used in production.
 */

const AWS = require('aws-sdk');
const { Client } = require('pg');

const secretsManager = new AWS.SecretsManager();
const s3 = new AWS.S3();
const connect = new AWS.Connect({ region: process.env.AWS_REGION || 'us-east-1' });

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Get database connection
 */
async function getDbClient() {
  const dbSecretArn = process.env.DB_SECRET_ARN;
  if (!dbSecretArn) {
    throw new Error('DB_SECRET_ARN environment variable not set');
  }

  const secretResponse = await secretsManager.getSecretValue({
    SecretId: dbSecretArn
  }).promise();

  let secretString = secretResponse.SecretString;
  
  // Handle encoding issues
  if (secretString.length > 0 && secretString.charCodeAt(0) === 0xFEFF) {
    secretString = secretString.slice(1);
  }
  secretString = secretString.replace(/^[\u0000-\u001F\u007F-\u009F]+/, '').trim();

  const dbCredentials = JSON.parse(secretString);

  const client = new Client({
    host: dbCredentials.host,
    port: dbCredentials.port || 5432,
    database: dbCredentials.dbname || dbCredentials.database,
    user: dbCredentials.username || dbCredentials.user,
    password: dbCredentials.password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  });

  await client.connect();
  return client;
}

/**
 * Ensure calls table exists with all required fields
 */
async function ensureCallsTable(client) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS calls (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID REFERENCES leads(id),
      connect_contact_id VARCHAR(255) UNIQUE,
      phone_number VARCHAR(20),
      call_duration INTEGER,
      recording_s3_key VARCHAR(500),
      recording_status VARCHAR(50) DEFAULT 'pending',
      status VARCHAR(50) DEFAULT 'initiated',
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
    CREATE INDEX IF NOT EXISTS idx_calls_connect_contact_id ON calls(connect_contact_id);
    CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
    CREATE INDEX IF NOT EXISTS idx_calls_recording_status ON calls(recording_status);
  `;
  
  await client.query(createTableQuery);
}

/**
 * Handle Connect contact event (call started, ended, etc.)
 */
async function handleConnectEvent(event) {
  console.log('Processing Connect event:', JSON.stringify(event));
  
  const client = await getDbClient();
  
  try {
    await ensureCallsTable(client);
    
    const { detail } = event;
    const contactId = detail?.ContactId || detail?.contactId;
    const eventType = detail?.EventType || detail?.eventType;
    
    if (!contactId) {
      throw new Error('Missing ContactId in Connect event');
    }
    
    // Check if call already exists (idempotency)
    const existingCall = await client.query(
      'SELECT id, status FROM calls WHERE connect_contact_id = $1',
      [contactId]
    );
    
    let callId;
    
    if (existingCall.rows.length > 0) {
      // Update existing call
      callId = existingCall.rows[0].id;
      console.log(`Updating existing call: ${callId} for contact: ${contactId}`);
      
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      if (eventType === 'CONTACT_STARTED' || eventType === 'contact-started') {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push('in-progress');
        updateFields.push(`started_at = $${paramIndex++}`);
        updateValues.push(new Date());
      } else if (eventType === 'CONTACT_ENDED' || eventType === 'contact-ended') {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push('completed');
        updateFields.push(`ended_at = $${paramIndex++}`);
        updateValues.push(new Date());
        
        // Extract duration if available
        const duration = detail?.Attributes?.Duration || detail?.duration;
        if (duration) {
          updateFields.push(`call_duration = $${paramIndex++}`);
          updateValues.push(parseInt(duration, 10));
        }
      }
      
      if (detail?.Attributes?.PhoneNumber || detail?.phoneNumber) {
        updateFields.push(`phone_number = $${paramIndex++}`);
        updateValues.push(detail.Attributes.PhoneNumber || detail.phoneNumber);
      }
      
      if (detail?.Attributes?.LeadId || detail?.leadId) {
        updateFields.push(`lead_id = $${paramIndex++}`);
        updateValues.push(detail.Attributes.LeadId || detail.leadId);
      }
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(callId);
      
      if (updateFields.length > 1) {
        const updateQuery = `
          UPDATE calls 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `;
        await client.query(updateQuery, updateValues);
      }
    } else {
      // Create new call record
      console.log(`Creating new call record for contact: ${contactId}`);
      
      const insertQuery = `
        INSERT INTO calls (
          connect_contact_id,
          lead_id,
          phone_number,
          status,
          started_at,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id
      `;
      
      const result = await client.query(insertQuery, [
        contactId,
        detail?.Attributes?.LeadId || detail?.leadId || null,
        detail?.Attributes?.PhoneNumber || detail?.phoneNumber || null,
        eventType === 'CONTACT_STARTED' || eventType === 'contact-started' ? 'in-progress' : 'initiated',
        new Date()
      ]);
      
      callId = result.rows[0].id;
    }
    
    await client.end();
    
    return {
      success: true,
      callId,
      contactId,
      eventType
    };
    
  } catch (error) {
    await client.end();
    console.error('Error processing Connect event:', error);
    throw error;
  }
}

/**
 * Handle S3 recording event (new recording uploaded)
 */
async function handleS3RecordingEvent(event) {
  console.log('Processing S3 recording event:', JSON.stringify(event));
  
  const client = await getDbClient();
  
  try {
    await ensureCallsTable(client);
    
    // Extract S3 object information
    const bucket = event.Records?.[0]?.s3?.bucket?.name;
    const key = decodeURIComponent(event.Records?.[0]?.s3?.object?.key || '').replace(/\+/g, ' ');
    const size = event.Records?.[0]?.s3?.object?.size;
    
    if (!bucket || !key) {
      throw new Error('Missing bucket or key in S3 event');
    }
    
    // Extract contact ID from S3 key (format: connect-recordings/{contactId}/recording.wav)
    const keyParts = key.split('/');
    let contactId = null;
    
    // Try to extract contact ID from path
    if (keyParts.length >= 2) {
      // Format: connect-recordings/{contactId}/...
      contactId = keyParts[1];
    } else if (key.includes('contactId=')) {
      // Alternative format with query params
      const match = key.match(/contactId=([^&]+)/);
      contactId = match ? match[1] : null;
    }
    
    if (!contactId) {
      console.warn(`Could not extract contact ID from S3 key: ${key}`);
      // Try to get contact ID from S3 object metadata
      try {
        const objectMetadata = await s3.headObject({ Bucket: bucket, Key: key }).promise();
        contactId = objectMetadata.Metadata?.['contact-id'] || objectMetadata.Metadata?.['contactId'];
      } catch (metadataError) {
        console.warn('Could not fetch S3 object metadata:', metadataError.message);
      }
    }
    
    if (!contactId) {
      throw new Error(`Could not determine contact ID for recording: ${key}`);
    }
    
    // Find call by contact ID
    const callResult = await client.query(
      'SELECT id, recording_s3_key FROM calls WHERE connect_contact_id = $1',
      [contactId]
    );
    
    if (callResult.rows.length === 0) {
      console.warn(`No call found for contact ID: ${contactId}, creating new record`);
      
      // Create call record if it doesn't exist
      const insertQuery = `
        INSERT INTO calls (
          connect_contact_id,
          recording_s3_key,
          recording_status,
          status,
          created_at
        ) VALUES ($1, $2, 'available', 'completed', CURRENT_TIMESTAMP)
        RETURNING id
      `;
      
      const result = await client.query(insertQuery, [contactId, key]);
      console.log(`Created new call record: ${result.rows[0].id}`);
    } else {
      // Update existing call with recording info
      const callId = callResult.rows[0].id;
      
      // Check if recording already processed (idempotency)
      if (callResult.rows[0].recording_s3_key === key) {
        console.log(`Recording ${key} already processed for call ${callId}`);
      } else {
        const updateQuery = `
          UPDATE calls 
          SET 
            recording_s3_key = $1,
            recording_status = 'available',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        
        await client.query(updateQuery, [key, callId]);
        console.log(`Updated call ${callId} with recording: ${key}`);
      }
    }
    
    await client.end();
    
    return {
      success: true,
      bucket,
      key,
      contactId,
      size
    };
    
  } catch (error) {
    await client.end();
    console.error('Error processing S3 recording event:', error);
    throw error;
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Lambda invoked with event:', JSON.stringify(event));
  
  try {
    // Determine event source
    if (event.source === 'aws.connect' || event['detail-type']?.includes('Connect')) {
      // Connect event
      return await handleConnectEvent(event);
    } else if (event.Records && event.Records[0]?.eventSource === 'aws:s3') {
      // S3 event
      return await handleS3RecordingEvent(event);
    } else {
      throw new Error(`Unknown event source: ${JSON.stringify(event)}`);
    }
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    // Return error for retry (Lambda will retry based on configuration)
    throw error;
  }
};

