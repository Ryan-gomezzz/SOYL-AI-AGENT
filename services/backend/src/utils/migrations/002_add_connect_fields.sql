-- Migration: Add Twilio-specific fields to calls table
-- Date: 2024-11-26
-- Description: Adds twilio_call_sid and recording_status fields for Twilio Voice integration
-- Note: Amazon Connect evaluation aborted due to AISPL account restrictions; replaced by Twilio Voice

-- Add twilio_call_sid field if it doesn't exist (replaces connect_contact_id)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'twilio_call_sid'
    ) THEN
        ALTER TABLE calls ADD COLUMN twilio_call_sid VARCHAR(255) UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid);
    END IF;
END $$;

-- Rename connect_contact_id to twilio_call_sid if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'connect_contact_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'twilio_call_sid'
    ) THEN
        ALTER TABLE calls RENAME COLUMN connect_contact_id TO twilio_call_sid;
        DROP INDEX IF EXISTS idx_calls_connect_contact_id;
        CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid);
    END IF;
END $$;

-- Add recording_status field if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calls' AND column_name = 'recording_status'
    ) THEN
        ALTER TABLE calls ADD COLUMN recording_status VARCHAR(50) DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_calls_recording_status ON calls(recording_status);
    END IF;
END $$;

-- Update existing records to have default recording_status
UPDATE calls SET recording_status = 'pending' WHERE recording_status IS NULL;

