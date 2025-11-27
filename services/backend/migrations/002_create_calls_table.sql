-- Migration: Create calls table
-- Description: Creates the calls table as per reference/README.md data model
-- Date: 2024-11-26

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    twilio_call_sid VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    call_duration INTEGER, -- in seconds
    recording_s3_key VARCHAR(500),
    recording_status VARCHAR(50) DEFAULT 'pending',
    status VARCHAR(50) DEFAULT 'initiated',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid) WHERE twilio_call_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_recording_status ON calls(recording_status);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC) WHERE started_at IS NOT NULL;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE calls IS 'Stores call records from Twilio Voice';
COMMENT ON COLUMN calls.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN calls.lead_id IS 'Reference to leads table';
COMMENT ON COLUMN calls.twilio_call_sid IS 'Twilio Call SID (unique)';
COMMENT ON COLUMN calls.phone_number IS 'Phone number called';
COMMENT ON COLUMN calls.call_duration IS 'Call duration in seconds';
COMMENT ON COLUMN calls.recording_s3_key IS 'S3 key for call recording';
COMMENT ON COLUMN calls.recording_status IS 'Recording status (pending, available, processing, failed)';
COMMENT ON COLUMN calls.status IS 'Call status (initiated, in-progress, completed, failed, cancelled)';
COMMENT ON COLUMN calls.started_at IS 'Call start timestamp';
COMMENT ON COLUMN calls.ended_at IS 'Call end timestamp';
COMMENT ON COLUMN calls.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN calls.updated_at IS 'Record last update timestamp';

