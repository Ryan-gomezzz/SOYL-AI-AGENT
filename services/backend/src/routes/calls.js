/**
 * Calls Routes
 * 
 * Production-ready calls management endpoints with comprehensive edge case handling:
 * - Pagination validation and limits
 * - SQL injection prevention
 * - Large dataset handling
 * - Empty result handling
 * - Timeout protection
 * - Connection error handling
 * - Join with leads and transcripts
 */

const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Constants for pagination and filtering
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGE = 1;

// Valid status values
const VALID_STATUSES = ['initiated', 'in-progress', 'completed', 'failed', 'cancelled'];
const VALID_RECORDING_STATUSES = ['pending', 'available', 'processing', 'failed'];

/**
 * Sanitize and validate filter values to prevent SQL injection
 */
function sanitizeFilter(value, allowedValues = null) {
  if (!value) return null;
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (allowedValues && !allowedValues.includes(sanitized)) {
    return null;
  }
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * GET /api/v1/calls
 * Get list of calls with pagination and filtering
 * 
 * Query parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, min: 1, max: 100)
 * - status: Filter by status (optional, validated)
 * - lead_id: Filter by lead ID (optional, UUID)
 * - recording_status: Filter by recording status (optional)
 */
router.get('/calls', async (req, res) => {
  try {
    // Parse and validate pagination parameters
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    if (isNaN(page) || page < 1) {
      page = DEFAULT_PAGE;
    }
    
    if (isNaN(limit) || limit < 1) {
      limit = DEFAULT_LIMIT;
    } else if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }
    
    const maxOffset = 10000;
    const offset = (page - 1) * limit;
    
    if (offset > maxOffset) {
      return res.status(400).json({
        error: 'Invalid pagination',
        message: `Offset too large. Maximum offset is ${maxOffset}. Use search/filtering instead.`
      });
    }

    // Sanitize and validate filters
    const status = sanitizeFilter(req.query.status, VALID_STATUSES);
    const recordingStatus = sanitizeFilter(req.query.recording_status, VALID_RECORDING_STATUSES);
    const leadId = req.query.lead_id ? req.query.lead_id.trim() : null;
    
    // Validate UUID format if lead_id provided
    if (leadId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(leadId)) {
        return res.status(400).json({
          error: 'Invalid lead ID format',
          message: 'Lead ID must be a valid UUID'
        });
      }
    }

    // Build WHERE clause dynamically
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (recordingStatus) {
      whereConditions.push(`c.recording_status = $${paramIndex}`);
      params.push(recordingStatus);
      paramIndex++;
    }

    if (leadId) {
      whereConditions.push(`c.lead_id = $${paramIndex}`);
      params.push(leadId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM calls c ${whereClause}`;
    
    // Data query with joins to get lead and transcript info
    const dataQuery = `
      SELECT 
        c.id,
        c.lead_id,
        c.twilio_call_sid,
        c.phone_number,
        c.call_duration,
        c.recording_s3_key,
        c.recording_status,
        c.status,
        c.started_at,
        c.ended_at,
        c.created_at,
        c.updated_at,
        l.name as lead_name,
        l.email as lead_email,
        (SELECT COUNT(*) FROM transcripts t WHERE t.call_id = c.id) as transcript_count
      FROM calls c
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
      ORDER BY c.created_at DESC 
      LIMIT $${paramIndex} 
      OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Execute queries in parallel
    let countResult, dataResult;
    
    try {
      [countResult, dataResult] = await Promise.all([
        query(
          countQuery, 
          whereConditions.length > 0 ? params.slice(0, -2) : [],
          { timeout: 5000, retries: 1 }
        ),
        query(
          dataQuery, 
          params,
          { timeout: 10000, retries: 1 }
        )
      ]);
    } catch (dbError) {
      if (dbError.message && dbError.message.includes('timeout')) {
        return res.status(504).json({
          error: 'Gateway timeout',
          message: 'Query took too long. Try filtering or reducing limit.'
        });
      }
      
      if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Database connection failed'
        });
      }
      
      throw dbError;
    }

    let total = 0;
    try {
      total = parseInt(countResult.rows[0]?.total || '0', 10);
    } catch (parseError) {
      console.error('Error parsing total count:', parseError);
      total = 0;
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    
    if (page > totalPages && totalPages > 0) {
      return res.status(400).json({
        error: 'Invalid page number',
        message: `Page ${page} exceeds total pages (${totalPages})`,
        pagination: {
          page: 1,
          limit,
          total,
          totalPages,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    return res.json({
      calls: dataResult.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching calls:', {
      error: error.message,
      code: error.code,
      query: req.query
    });
    
    if (error.message && error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Request took too long to process'
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Database connection failed'
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production'
        ? 'An error occurred fetching calls'
        : error.message
    });
  }
});

/**
 * GET /api/v1/calls/:id
 * Get a specific call by ID with transcript information
 */
router.get('/calls/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid call ID format',
        message: 'Call ID must be a valid UUID'
      });
    }

    // Query call with lead and transcript info
    let result;
    try {
      result = await query(
        `SELECT 
          c.id,
          c.lead_id,
          c.twilio_call_sid,
          c.phone_number,
          c.call_duration,
          c.recording_s3_key,
          c.recording_status,
          c.status,
          c.started_at,
          c.ended_at,
          c.created_at,
          c.updated_at,
          l.name as lead_name,
          l.email as lead_email,
          l.phone as lead_phone,
          l.enquiry_type as lead_enquiry_type,
          (SELECT json_agg(
            json_build_object(
              'id', t.id,
              'transcript_s3_key', t.transcript_s3_key,
              'raw_transcript', t.raw_transcript,
              'processed_transcript', t.processed_transcript,
              'language', t.language,
              'confidence_score', t.confidence_score,
              'created_at', t.created_at
            )
          ) FROM transcripts t WHERE t.call_id = c.id) as transcripts
        FROM calls c
        LEFT JOIN leads l ON c.lead_id = l.id
        WHERE c.id = $1`,
        [id],
        { timeout: 5000, retries: 1 }
      );
    } catch (dbError) {
      if (dbError.message && dbError.message.includes('timeout')) {
        return res.status(504).json({
          error: 'Gateway timeout',
          message: 'Request took too long to process'
        });
      }
      
      if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND') {
        return res.status(503).json({
          error: 'Service unavailable',
          message: 'Database connection failed'
        });
      }
      
      throw dbError;
    }

    if (!result || !result.rows || result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Call not found'
      });
    }

    const call = result.rows[0];
    
    // Parse transcripts JSON if present
    if (call.transcripts && typeof call.transcripts === 'string') {
      try {
        call.transcripts = JSON.parse(call.transcripts);
      } catch (parseError) {
        call.transcripts = [];
      }
    } else if (!call.transcripts) {
      call.transcripts = [];
    }

    return res.json({
      call
    });

  } catch (error) {
    console.error('Error fetching call:', {
      error: error.message,
      code: error.code,
      callId: req.params.id
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production'
        ? 'An error occurred fetching the call'
        : error.message
    });
  }
});

module.exports = router;

