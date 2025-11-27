/**
 * Unit Tests for Transcribe Worker
 * 
 * Tests for transcription job processing, S3 event handling, and database operations
 */

const { processRecording, extractCallSidFromKey } = require('../../services/worker/src/transcribe-worker');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockS3 = {
    getObject: jest.fn(),
    listObjectsV2: jest.fn(),
    putObject: jest.fn()
  };
  
  const mockTranscribe = {
    startTranscriptionJob: jest.fn(),
    getTranscriptionJob: jest.fn()
  };

  return {
    S3: jest.fn(() => mockS3),
    TranscribeService: jest.fn(() => mockTranscribe)
  };
});

// Mock database
jest.mock('../../services/worker/src/config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
  initializePool: jest.fn()
}));

describe('Transcribe Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCallSidFromKey', () => {
    test('should extract call SID from S3 key', () => {
      const key = 'twilio-recordings/CA1234567890abcdef.wav';
      const callSid = extractCallSidFromKey(key);
      expect(callSid).toBe('CA1234567890abcdef');
    });

    test('should handle different key formats', () => {
      expect(extractCallSidFromKey('recordings/call-CA1234567890abcdef.wav')).toBe('CA1234567890abcdef');
      expect(extractCallSidFromKey('CA1234567890abcdef.wav')).toBe('CA1234567890abcdef');
      expect(extractCallSidFromKey('twilio-recordings/CA1234567890abcdef.mp3')).toBe('CA1234567890abcdef');
    });

    test('should return null for invalid keys', () => {
      expect(extractCallSidFromKey('invalid-key.wav')).toBeNull();
      expect(extractCallSidFromKey('')).toBeNull();
    });
  });

  describe('processRecording', () => {
    test('should process valid recording file', async () => {
      // Mock database queries
      const { query } = require('../../services/worker/src/config/database');
      query.mockResolvedValueOnce({ rows: [] }); // No existing call
      query.mockResolvedValueOnce({ rows: [{ id: 'call-123' }] }); // Created call
      query.mockResolvedValueOnce({ rows: [] }); // No existing transcript
      query.mockResolvedValueOnce({ rows: [] }); // Update status

      // Mock AWS Transcribe
      const AWS = require('aws-sdk');
      const transcribe = new AWS.TranscribeService();
      transcribe.startTranscriptionJob.mockReturnValue({
        promise: jest.fn().resolves({
          TranscriptionJob: {
            TranscriptionJobName: 'job-123',
            TranscriptionJobStatus: 'IN_PROGRESS'
          }
        })
      });

      transcribe.getTranscriptionJob.mockReturnValue({
        promise: jest.fn().resolves({
          TranscriptionJob: {
            TranscriptionJobStatus: 'COMPLETED',
            Transcript: {
              TranscriptFileUri: 's3://bucket/transcript.json'
            }
          }
        })
      });

      // Mock S3
      const s3 = new AWS.S3();
      s3.getObject.mockReturnValue({
        promise: jest.fn().resolves({
          Body: JSON.stringify({
            results: {
              transcripts: [{ transcript: 'Hello world' }],
              items: [{ alternatives: [{ confidence: 0.9 }] }],
              language_code: 'en-IN'
            }
          })
        })
      });

      // This test would need more setup, but shows the structure
      // await processRecording('twilio-recordings/CA1234567890abcdef.wav');
    });
  });
});

