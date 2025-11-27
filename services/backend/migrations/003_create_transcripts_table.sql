-- Migration: Create transcripts table
-- Description: Creates the transcripts table as per reference/README.md data model
-- Date: 2024-11-26

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
    transcript_s3_key VARCHAR(500),
    raw_transcript TEXT,
    processed_transcript TEXT,
    language VARCHAR(10) DEFAULT 'en',
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_language ON transcripts(language);

-- Add full-text search index for transcript text (if needed)
-- CREATE INDEX IF NOT EXISTS idx_transcripts_text_search ON transcripts USING gin(to_tsvector('english', COALESCE(processed_transcript, raw_transcript)));

-- Add comments for documentation
COMMENT ON TABLE transcripts IS 'Stores call transcripts from AWS Transcribe';
COMMENT ON COLUMN transcripts.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN transcripts.call_id IS 'Reference to calls table';
COMMENT ON COLUMN transcripts.transcript_s3_key IS 'S3 key for transcript file';
COMMENT ON COLUMN transcripts.raw_transcript IS 'Raw transcript text from AWS Transcribe';
COMMENT ON COLUMN transcripts.processed_transcript IS 'Processed/cleaned transcript text';
COMMENT ON COLUMN transcripts.language IS 'Transcript language code (e.g., en, hi)';
COMMENT ON COLUMN transcripts.confidence_score IS 'Transcription confidence score (0.0-1.0)';
COMMENT ON COLUMN transcripts.created_at IS 'Record creation timestamp';

