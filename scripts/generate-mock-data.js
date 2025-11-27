/**
 * Generate Mock Data for Development
 * 
 * Creates sample leads, calls, and transcripts for testing the frontend
 * and backend endpoints.
 * 
 * Usage: node scripts/generate-mock-data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database configuration (for local development)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'ai_ca_agent_db',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: false
});

// Sample data
const sampleNames = [
  'John Smith', 'Jane Doe', 'Robert Johnson', 'Emily Davis', 'Michael Brown',
  'Sarah Wilson', 'David Martinez', 'Jessica Anderson', 'Christopher Taylor', 'Amanda Thomas',
  'James Jackson', 'Lisa White', 'Daniel Harris', 'Michelle Martin', 'Matthew Thompson',
  'Ashley Garcia', 'Andrew Martinez', 'Stephanie Robinson', 'Joshua Clark', 'Nicole Rodriguez'
];

const sampleEmails = sampleNames.map(name => 
  `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`
);

const samplePhones = [
  '+1-555-0101', '+1-555-0102', '+1-555-0103', '+1-555-0104', '+1-555-0105',
  '+1-555-0106', '+1-555-0107', '+1-555-0108', '+1-555-0109', '+1-555-0110'
];

const enquiryTypes = ['GST Registration', 'Income Tax Filing', 'Company Registration', 'Trademark', 'Compliance'];
const sources = ['website', 'referral', 'social', 'direct'];
const statuses = ['pending', 'contacted', 'converted', 'rejected'];
const callStatuses = ['initiated', 'in-progress', 'completed', 'failed'];
const recordingStatuses = ['pending', 'available', 'processing', 'failed'];

// Sample transcript texts
const sampleTranscripts = [
  `Hello, thank you for calling. I'm interested in learning more about your GST registration services. Can you tell me what documents I would need?`,
  `Hi there, I need help with my income tax filing. This is my first time filing taxes and I'm not sure where to start.`,
  `Good morning, I'm calling about company registration. I want to start a new business and need guidance on the process.`,
  `Hello, I'm interested in trademark registration. How long does the process typically take?`,
  `Hi, I received a notice about compliance requirements. Can you help me understand what I need to do?`,
  `Thank you for taking my call. I'm looking for assistance with GST compliance. What are the monthly requirements?`,
  `Hello, I need help with income tax planning for the upcoming year. What services do you offer?`,
  `Good afternoon, I'm calling about company registration for a partnership firm. What's the process?`,
  `Hi, I want to register a trademark for my brand. Can you walk me through the steps?`,
  `Hello, I have questions about annual compliance requirements for my company. Can you help?`
];

async function generateMockData() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Generating mock data...\n');
    
    // Check if tables exist
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'calls', 'transcripts')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    
    if (!existingTables.includes('leads')) {
      console.log('⚠️  Leads table does not exist. Please run migrations first.');
      return;
    }
    
    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing mock data...');
    await client.query('DELETE FROM transcripts WHERE call_id IN (SELECT id FROM calls)');
    await client.query('DELETE FROM calls');
    await client.query('DELETE FROM leads WHERE email LIKE \'%@example.com\'');
    
    // Generate leads
    console.log('📝 Creating leads...');
    const leads = [];
    for (let i = 0; i < 20; i++) {
      const name = sampleNames[i];
      const email = sampleEmails[i];
      const phone = samplePhones[i % samplePhones.length];
      const enquiryType = enquiryTypes[Math.floor(Math.random() * enquiryTypes.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const result = await client.query(`
        INSERT INTO leads (name, email, phone, enquiry_type, source, status, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')
        RETURNING id
      `, [name, email, phone, enquiryType, source, status, `Sample lead ${i + 1} - ${enquiryType} enquiry`]);
      
      leads.push({ id: result.rows[0].id, name, email, phone });
    }
    console.log(`✅ Created ${leads.length} leads\n`);
    
    // Generate calls (if calls table exists)
    if (existingTables.includes('calls')) {
      console.log('📞 Creating calls...');
      const calls = [];
      for (let i = 0; i < 15; i++) {
        const lead = leads[Math.floor(Math.random() * leads.length)];
        const status = callStatuses[Math.floor(Math.random() * callStatuses.length)];
        const recordingStatus = recordingStatuses[Math.floor(Math.random() * recordingStatuses.length)];
        const duration = status === 'completed' ? Math.floor(Math.random() * 600) + 60 : null; // 1-10 minutes
        const startedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)); // Last 7 days
        const endedAt = status === 'completed' ? new Date(startedAt.getTime() + (duration * 1000)) : null;
        
        const result = await client.query(`
          INSERT INTO calls (
            lead_id, phone_number, call_duration, recording_s3_key, 
            recording_status, status, started_at, ended_at, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          lead.id,
          lead.phone,
          duration,
          status === 'completed' ? `s3://recordings/call-${i + 1}.wav` : null,
          recordingStatus,
          status,
          startedAt,
          endedAt,
          startedAt
        ]);
        
        calls.push({ id: result.rows[0].id, lead_id: lead.id, status });
      }
      console.log(`✅ Created ${calls.length} calls\n`);
      
      // Generate transcripts (if transcripts table exists)
      if (existingTables.includes('transcripts')) {
        console.log('📄 Creating transcripts...');
        let transcriptCount = 0;
        for (const call of calls) {
          // Only create transcripts for completed calls
          if (call.status === 'completed' && Math.random() > 0.3) { // 70% of completed calls have transcripts
            const transcriptText = sampleTranscripts[Math.floor(Math.random() * sampleTranscripts.length)];
            const confidence = 0.7 + Math.random() * 0.25; // 0.7-0.95
            
            await client.query(`
              INSERT INTO transcripts (
                call_id, transcript_s3_key, raw_transcript, processed_transcript,
                language, confidence_score, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              call.id,
              `s3://transcripts/transcript-${call.id}.json`,
              transcriptText,
              transcriptText, // In real scenario, processed might be different
              'en',
              confidence,
              new Date(Date.now() - Math.floor(Math.random() * 6 * 24 * 60 * 60 * 1000))
            ]);
            
            transcriptCount++;
          }
        }
        console.log(`✅ Created ${transcriptCount} transcripts\n`);
      }
    }
    
    console.log('✨ Mock data generation complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Leads: ${leads.length}`);
    if (existingTables.includes('calls')) {
      const callsCount = await client.query('SELECT COUNT(*) as count FROM calls');
      console.log(`   - Calls: ${callsCount.rows[0].count}`);
    }
    if (existingTables.includes('transcripts')) {
      const transcriptsCount = await client.query('SELECT COUNT(*) as count FROM transcripts');
      console.log(`   - Transcripts: ${transcriptsCount.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Error generating mock data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  generateMockData()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { generateMockData };

