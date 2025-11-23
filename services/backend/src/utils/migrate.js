/**
 * Database Migration Runner
 * 
 * Production-ready migration system with:
 * - Migration tracking table
 * - Transaction support
 * - Rollback capability
 * - Idempotent migrations
 */

const fs = require('fs').promises;
const path = require('path');
const { query, transaction } = require('../config/database');

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64)
    );
    
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_filename 
    ON schema_migrations(filename);
  `;
  
  await query(sql);
}

/**
 * Get list of executed migrations
 * @returns {Promise<Array>} List of executed migration filenames
 */
async function getExecutedMigrations() {
  try {
    const result = await query('SELECT filename FROM schema_migrations ORDER BY id');
    return result.rows.map(row => row.filename);
  } catch (error) {
    // If table doesn't exist, return empty array
    if (error.message.includes('does not exist')) {
      return [];
    }
    throw error;
  }
}

/**
 * Calculate file checksum (simple hash)
 * @param {string} content - File content
 * @returns {string} Checksum
 */
function calculateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Execute a migration file
 * @param {string} filename - Migration filename
 * @param {string} content - Migration SQL content
 */
async function executeMigration(filename, content) {
  const checksum = calculateChecksum(content);
  
  await transaction(async (client) => {
    // Execute migration SQL
    await client.query(content);
    
    // Record migration
    await client.query(
      'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
      [filename, checksum]
    );
  });
  
  console.log(`✅ Migration executed: ${filename}`);
}

/**
 * Run all pending migrations
 * @returns {Promise<number>} Number of migrations executed
 */
async function runMigrations() {
  try {
    // Ensure migrations table exists
    await ensureMigrationsTable();
    
    // Get executed migrations
    const executedMigrations = await getExecutedMigrations();
    
    // Read migration directory
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    
    // Filter and sort SQL files
    const migrationFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    let executedCount = 0;
    
    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (!executedMigrations.includes(filename)) {
        const filePath = path.join(migrationsDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        
        console.log(`Running migration: ${filename}...`);
        await executeMigration(filename, content);
        executedCount++;
      } else {
        console.log(`⏭️  Migration already executed: ${filename}`);
      }
    }
    
    if (executedCount === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
    } else {
      console.log(`✅ Executed ${executedCount} migration(s)`);
    }
    
    return executedCount;
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

/**
 * Check migration status
 */
async function checkMigrationStatus() {
  try {
    await ensureMigrationsTable();
    const executedMigrations = await getExecutedMigrations();
    
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files.filter(file => file.endsWith('.sql')).sort();
    
    console.log('\n📊 Migration Status:');
    console.log('─'.repeat(60));
    
    for (const filename of migrationFiles) {
      const status = executedMigrations.includes(filename) ? '✅ Executed' : '⏳ Pending';
      console.log(`${status.padEnd(12)} | ${filename}`);
    }
    
    console.log('─'.repeat(60));
    console.log(`Total: ${migrationFiles.length} migration(s)`);
    console.log(`Executed: ${executedMigrations.length}`);
    console.log(`Pending: ${migrationFiles.length - executedMigrations.length}\n`);
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    throw error;
  }
}

// CLI support
if (require.main === module) {
  const command = process.argv[2] || 'run';
  
  (async () => {
    try {
      // Initialize database connection
      const { initializePool } = require('../config/database');
      await initializePool();
      
      if (command === 'run') {
        await runMigrations();
      } else if (command === 'status') {
        await checkMigrationStatus();
      } else {
        console.error(`Unknown command: ${command}`);
        console.log('Usage: node migrate.js [run|status]');
        process.exit(1);
      }
      
      // Close connection
      const { closePool } = require('../config/database');
      await closePool();
      process.exit(0);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  runMigrations,
  checkMigrationStatus
};

