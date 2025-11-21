const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder routes
app.get('/api/v1/status', (req, res) => {
  res.json({
    service: 'backend',
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Enquiry endpoint (placeholder)
app.post('/api/v1/enquiry', async (req, res) => {
  try {
    // TODO: Implement enquiry handling
    // - Validate payload
    // - Save to RDS
    // - Publish to SQS or trigger worker
    res.json({ message: 'Enquiry received', data: req.body });
  } catch (error) {
    console.error('Error processing enquiry:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

