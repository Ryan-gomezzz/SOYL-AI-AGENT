-- Migration: Create leads table
-- Description: Creates the leads table as per reference/README.md data model
-- Date: 2024-11-22

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    source VARCHAR(100),
    enquiry_type VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT leads_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source) WHERE source IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE leads IS 'Stores lead/enquiry information';
COMMENT ON COLUMN leads.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN leads.name IS 'Lead full name';
COMMENT ON COLUMN leads.phone IS 'Lead phone number';
COMMENT ON COLUMN leads.email IS 'Lead email address (validated)';
COMMENT ON COLUMN leads.source IS 'Lead source (e.g., website, referral)';
COMMENT ON COLUMN leads.enquiry_type IS 'Type of enquiry (e.g., GST, Income Tax)';
COMMENT ON COLUMN leads.notes IS 'Additional notes about the lead';
COMMENT ON COLUMN leads.status IS 'Current status (pending, contacted, converted, etc.)';
COMMENT ON COLUMN leads.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN leads.updated_at IS 'Record last update timestamp';

