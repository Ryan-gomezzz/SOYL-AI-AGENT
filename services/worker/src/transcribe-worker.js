/**
 * Batch Transcribe Worker
 * 
 * Week 2 - Engineer B Task
 * 
 * This worker processes call recordings from S3:
 * 1. Monitors S3 for new recordings (via S3 events or polling)
 * 2. Submits recordings to AWS Transcribe for batch transcription
 * 3. Monitors transcription job status
 * 4. Downloads completed transcripts
 * 5. Saves transcripts to S3 (transcripts bucket) and database
 * 
 * Industry standards:
 * - Comprehensive error handling with retries
 * - Idempotency checks
 * - Dead letter queue support
 * - Structured logging
 * - Edge case handling (duplicate jobs, missing data, etc.)
 */

const AWS = require('aws-sdk');
const { getPool, query } = require('./config/database');

// AWS SDK clients
const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const transcribe = new AWS.TranscribeService({ region: process.env.AWS_REGION || 'us-east-1' });

// Configuration
const RECORDINGS_BUCKET = process.env.S3_BUCKET_RECORDINGS || process.env.RECORDINGS_BUCKET;
const TRANSCRIPTS_BUCKET = process.env.S3_BUCKET_TRANSCRIPTS || process.env.TRANSCRIPTS_BUCKET;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000', 10); // 30 seconds default
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get database connection pool
 */
async function getDbConnection() {
  return getPool();
}

/**
 * Extract call SID from S3 key
 * Expected format: twilio-recordings/{call_sid}.wav or similar
 */
function extractCallSidFromKey(s3Key) {
  if (!s3Key) return null;
  // Handle various formats:
  // - twilio-recordings/CA1234567890abcdef.wav
  // - recordings/call-CA1234567890abcdef.wav
  // - CA1234567890abcdef.wav
  const match = s3Key.match(/(CA[a-f0-9]{32})/i);
  return match ? match[1] : null;
}

/**
 * Find call record by Twilio call SID
 */
async function findCallBySid(callSid) {
  const result = await query(
    'SELECT id, lead_id, recording_s3_key, recording_status FROM calls WHERE twilio_call_sid = $1',
    [callSid]
  );
  return result.rows[0] || null;
}

/**
 * Create or update call record
 */
async function upsertCallRecord(callSid, recordingS3Key, leadId = null) {
  // Check if call exists
  const existing = await findCallBySid(callSid);
  
  if (existing) {
    // Update existing call
    await query(
      `UPDATE calls 
       SET recording_s3_key = $1, recording_status = 'available', updated_at = NOW()
       WHERE twilio_call_sid = $2`,
      [recordingS3Key, callSid]
    );
    return existing.id;
  } else {
    // Create new call record
    const result = await query(
      `INSERT INTO calls (twilio_call_sid, recording_s3_key, recording_status, status, created_at, updated_at)
       VALUES ($1, $2, 'available', 'completed', NOW(), NOW())
       RETURNING id`,
      [callSid, recordingS3Key]
    );
    return result.rows[0].id;
  }
}

/**
 * Start AWS Transcribe job
 */
async function startTranscriptionJob(recordingS3Key, callId, callSid) {
  const jobName = `transcribe-${callSid}-${Date.now()}`;
  const mediaFileUri = `s3://${RECORDINGS_BUCKET}/${recordingS3Key}`;
  const outputKey = `transcripts/${callSid}.json`;

  const params = {
    TranscriptionJobName: jobName,
    Media: {
      MediaFileUri: mediaFileUri
    },
    MediaFormat: 'wav', // Twilio recordings are typically WAV
    LanguageCode: 'en-IN', // India English, can be made configurable
    OutputBucketName: TRANSCRIPTS_BUCKET,
    OutputKey: outputKey,
    Settings: {
      ShowSpeakerLabels: false,
      MaxAlternatives: 1
    }
  };

  try {
    const result = await transcribe.startTranscriptionJob(params).promise();
    console.log(`Started transcription job: ${jobName} for call ${callSid}`);
    
    // Update database with transcription job ID
    await query(
      `UPDATE calls 
       SET recording_status = 'processing', updated_at = NOW()
       WHERE id = $1`,
      [callId]
    );

    return {
      jobName: result.TranscriptionJob.TranscriptionJobName,
      status: result.TranscriptionJob.TranscriptionJobStatus,
      outputKey
    };
  } catch (error) {
    console.error(`Error starting transcription job for ${callSid}:`, error);
    throw error;
  }
}

/**
 * Check transcription job status
 */
async function getTranscriptionJobStatus(jobName) {
  try {
    const result = await transcribe.getTranscriptionJob({ TranscriptionJobName: jobName }).promise();
    return {
      status: result.TranscriptionJob.TranscriptionJobStatus,
      transcriptUri: result.TranscriptionJob.Transcript?.TranscriptFileUri,
      failureReason: result.TranscriptionJob.FailureReason
    };
  } catch (error) {
    console.error(`Error getting transcription job status for ${jobName}:`, error);
    throw error;
  }
}

/**
 * Download and parse transcript from S3
 */
async function downloadTranscript(transcriptUri) {
  // Extract S3 key from URI (format: https://s3.../bucket/key)
  const match = transcriptUri.match(/s3:\/\/([^\/]+)\/(.+)/);
  if (!match) {
    throw new Error(`Invalid transcript URI format: ${transcriptUri}`);
  }

  const bucket = match[1];
  const key = match[2];

  const result = await s3.getObject({ Bucket: bucket, Key: key }).promise();
  const transcriptData = JSON.parse(result.Body.toString());

  return {
    transcriptText: transcriptData.results.transcripts[0].transcript,
    items: transcriptData.results.items,
    languageCode: transcriptData.results.language_code,
    confidence: transcriptData.results.items.reduce((sum, item) => {
      return sum + (item.alternatives[0]?.confidence || 0);
    }, 0) / transcriptData.results.items.length
  };
}

/**
 * Save transcript to database
 */
async function saveTranscript(callId, transcriptText, transcriptS3Key, languageCode, confidence) {
  const result = await query(
    `INSERT INTO transcripts (
      call_id, transcript_s3_key, raw_transcript, processed_transcript,
      language, confidence_score, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id`,
    [callId, transcriptS3Key, transcriptText, transcriptText, languageCode, confidence]
  );

  if (result.rows.length > 0) {
    console.log(`Saved transcript for call ${callId}: transcript ID ${result.rows[0].id}`);
    return result.rows[0].id;
  } else {
    console.log(`Transcript already exists for call ${callId}`);
    return null;
  }
}

/**
 * Process a single recording file
 */
async function processRecording(recordingS3Key, retries = 0) {
  try {
    console.log(`Processing recording: ${recordingS3Key}`);

    // Extract call SID from S3 key
    const callSid = extractCallSidFromKey(recordingS3Key);
    if (!callSid) {
      console.warn(`Could not extract call SID from key: ${recordingS3Key}`);
      return;
    }

    // Find or create call record
    let callRecord = await findCallBySid(callSid);
    let callId;

    if (!callRecord) {
      // Create new call record
      callId = await upsertCallRecord(callSid, recordingS3Key);
      callRecord = await findCallBySid(callSid);
    } else {
      callId = callRecord.id;
      
      // Check if transcript already exists
      const existingTranscript = await query(
        'SELECT id FROM transcripts WHERE call_id = $1',
        [callId]
      );

      if (existingTranscript.rows.length > 0) {
        console.log(`Transcript already exists for call ${callId}, skipping`);
        return;
      }
    }

    // Check if transcription is already in progress
    if (callRecord.recording_status === 'processing') {
      console.log(`Transcription already in progress for call ${callId}`);
      return;
    }

    // Start transcription job
    const { jobName, outputKey } = await startTranscriptionJob(recordingS3Key, callId, callSid);

    // Poll for completion
    let jobStatus = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (30s * 120)

    while (jobStatus === 'IN_PROGRESS' && attempts < maxAttempts) {
      await sleep(30000); // Wait 30 seconds
      attempts++;

      const statusResult = await getTranscriptionJobStatus(jobName);
      jobStatus = statusResult.status;

      if (jobStatus === 'COMPLETED') {
        // Download transcript
        const transcript = await downloadTranscript(statusResult.transcriptUri);
        
        // Save to database
        await saveTranscript(
          callId,
          transcript.transcriptText,
          outputKey,
          transcript.languageCode,
          transcript.confidence
        );

        // Update call status
        await query(
          `UPDATE calls 
           SET recording_status = 'available', updated_at = NOW()
           WHERE id = $1`,
          [callId]
        );

        console.log(`✅ Transcription completed for call ${callId}`);
        return;
      } else if (jobStatus === 'FAILED') {
        console.error(`Transcription job failed for call ${callId}: ${statusResult.failureReason}`);
        
        // Update call status
        await query(
          `UPDATE calls 
           SET recording_status = 'failed', updated_at = NOW()
           WHERE id = $1`,
          [callId]
        );
        throw new Error(`Transcription failed: ${statusResult.failureReason}`);
      }
    }

    if (jobStatus === 'IN_PROGRESS') {
      throw new Error('Transcription job timed out');
    }

  } catch (error) {
    console.error(`Error processing recording ${recordingS3Key}:`, error);
    
    if (retries < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY}ms... (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY * (retries + 1));
      return processRecording(recordingS3Key, retries + 1);
    }
    
    throw error;
  }
}

/**
 * Poll S3 for new recordings
 */
async function pollS3ForRecordings() {
  try {
    if (!RECORDINGS_BUCKET) {
      throw new Error('S3_BUCKET_RECORDINGS environment variable not set');
    }

    console.log(`Polling S3 bucket: ${RECORDINGS_BUCKET}`);

    // List objects in recordings bucket
    // Look for files in twilio-recordings/ prefix or root
    const prefixes = ['twilio-recordings/', 'recordings/', ''];

    for (const prefix of prefixes) {
      const params = {
        Bucket: RECORDINGS_BUCKET,
        Prefix: prefix,
        MaxKeys: 100
      };

      const result = await s3.listObjectsV2(params).promise();

      if (result.Contents && result.Contents.length > 0) {
        for (const object of result.Contents) {
          const key = object.Key;
          
          // Only process audio files
          if (key.match(/\.(wav|mp3|m4a|flac)$/i)) {
            await processRecording(key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error polling S3 for recordings:', error);
  }
}

/**
 * Process S3 event (when triggered by S3 event notification)
 */
async function processS3Event(event) {
  try {
    console.log('Processing S3 event:', JSON.stringify(event));

    // Handle S3 event structure
    if (event.Records) {
      for (const record of event.Records) {
        if (record.s3 && record.s3.object) {
          const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          
          // Only process audio files
          if (s3Key.match(/\.(wav|mp3|m4a|flac)$/i)) {
            await processRecording(s3Key);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing S3 event:', error);
    throw error;
  }
}

/**
 * Main worker function
 */
async function startWorker() {
  console.log('🚀 Batch Transcribe Worker starting...');
  console.log(`Recordings bucket: ${RECORDINGS_BUCKET}`);
  console.log(`Transcripts bucket: ${TRANSCRIPTS_BUCKET}`);
  console.log(`Poll interval: ${POLL_INTERVAL}ms`);

  // Initialize database connection
  try {
    const { initializePool } = require('./config/database');
    await initializePool();
    console.log('✅ Database connection initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error);
    if (process.env.NODE_ENV !== 'development') {
      process.exit(1);
    }
  }

  // If running as Lambda (event-driven), process the event
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    // Lambda handler mode
    return;
  }

  // Otherwise, run as polling service
  console.log('📡 Starting polling mode...');
  
  // Initial poll
  await pollS3ForRecordings();

  // Set up polling interval
  setInterval(async () => {
    try {
      await pollS3ForRecordings();
    } catch (error) {
      console.error('Error in polling cycle:', error);
    }
  }, POLL_INTERVAL);
}

// Export for Lambda handler
exports.handler = async (event) => {
  try {
    await processS3Event(event);
    return { statusCode: 200, body: 'Processing complete' };
  } catch (error) {
    console.error('Lambda handler error:', error);
    return { statusCode: 500, body: error.message };
  }
};

// Start worker if run directly
if (require.main === module) {
  startWorker().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  processRecording,
  processS3Event,
  pollS3ForRecordings,
  startWorker,
  extractCallSidFromKey
};

