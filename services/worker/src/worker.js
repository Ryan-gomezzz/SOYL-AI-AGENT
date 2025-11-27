require('dotenv').config();

/**
 * Background Worker Service
 * 
 * Week 2 - Engineer B: Batch Transcribe Worker
 * 
 * This service processes background jobs:
 * - Transcribing call recordings (AWS Transcribe)
 * - Processing LLM responses (Week 3)
 * - Sending confirmation emails (Week 3)
 * - Updating lead status
 */

const { startWorker } = require('./transcribe-worker');

console.log('Worker service starting...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Start the transcribe worker
startWorker().catch(error => {
  console.error('Fatal error starting worker:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Worker shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Worker shutting down gracefully...');
  process.exit(0);
});

