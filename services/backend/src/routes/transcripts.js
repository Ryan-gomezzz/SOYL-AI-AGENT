/**
 * Transcripts Routes
 * 
 * Production-ready transcripts management endpoints with comprehensive edge case handling:
 * - Pagination validation and limits
 * - SQL injection prevention
 * - Large dataset handling
 * - Empty result handling
 * - Timeout protection
 * - Connection error handling
 * - Join with calls and leads
 */

const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Constants for pagination and filtering
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGE = 1;

/**
 * Sanitize search term to prevent SQL injection
 */
function sanitizeSearch(value) {
  if (!value) return null;
  // Allow alphanumeric, spaces, and basic punctuation for search
  return value.trim().substring(0, 100);
}

/**
 * GET /api/v1/transcripts
 * Get list of transcripts with pagination and filtering
 * 
 * Query parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, min: 1, max: 100)
 * - call_id: Filter by call ID (optional, UUID)
 * - lead_id: Filter by lead ID (optional, UUID)
 * - search: Search in transcript text (optional)
 */
router.get('/transcripts', async (req, res) => {
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
    const callId = req.query.call_id ? req.query.call_id.trim() : null;
    const leadId = req.query.lead_id ? req.query.lead_id.trim() : null;
    const search = sanitizeSearch(req.query.search);
    
    // Validate UUID format if provided
    if (callId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(callId)) {
        return res.status(400).json({
          error: 'Invalid call ID format',
          message: 'Call ID must be a valid UUID'
        });
      }
    }
    
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

    if (callId) {
      whereConditions.push(`t.call_id = $${paramIndex}`);
      params.push(callId);
      paramIndex++;
    }

    if (leadId) {
      whereConditions.push(`c.lead_id = $${paramIndex}`);
      params.push(leadId);
      paramIndex++;
    }

    // Search in transcript text (case-insensitive)
    if (search && search.length >= 2) {
      whereConditions.push(`(
        LOWER(t.raw_transcript) LIKE LOWER($${paramIndex}) OR 
        LOWER(t.processed_transcript) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM transcripts t
      LEFT JOIN calls c ON t.call_id = c.id
      ${whereClause}
    `;
    
    // Data query with joins to get call and lead info
    const dataQuery = `
      SELECT 
        t.id,
        t.call_id,
        t.transcript_s3_key,
        t.raw_transcript,
        t.processed_transcript,
        t.language,
        t.confidence_score,
        t.created_at,
        c.id as call_id_full,
        c.lead_id,
        c.phone_number,
        c.call_duration,
        c.status as call_status,
        c.started_at,
        c.ended_at,
        l.name as lead_name,
        l.email as lead_email
      FROM transcripts t
      LEFT JOIN calls c ON t.call_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
      ORDER BY t.created_at DESC 
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
      transcripts: dataResult.rows || [],
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
    console.error('Error fetching transcripts:', {
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
        ? 'An error occurred fetching transcripts'
        : error.message
    });
  }
});

/**
 * GET /api/v1/transcripts/:id
 * Get a specific transcript by ID with call and lead information
 */
router.get('/transcripts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid transcript ID format',
        message: 'Transcript ID must be a valid UUID'
      });
    }

    // Query transcript with call and lead info
    let result;
    try {
      result = await query(
        `SELECT 
          t.id,
          t.call_id,
          t.transcript_s3_key,
          t.raw_transcript,
          t.processed_transcript,
          t.language,
          t.confidence_score,
          t.created_at,
          c.id as call_id_full,
          c.lead_id,
          c.twilio_call_sid,
          c.phone_number,
          c.call_duration,
          c.recording_s3_key,
          c.recording_status,
          c.status as call_status,
          c.started_at,
          c.ended_at,
          l.name as lead_name,
          l.email as lead_email,
          l.phone as lead_phone,
          l.enquiry_type as lead_enquiry_type
        FROM transcripts t
        LEFT JOIN calls c ON t.call_id = c.id
        LEFT JOIN leads l ON c.lead_id = l.id
        WHERE t.id = $1`,
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
        message: 'Transcript not found'
      });
    }

    const transcript = result.rows[0];

    return res.json({
      transcript
    });

  } catch (error) {
    console.error('Error fetching transcript:', {
      error: error.message,
      code: error.code,
      transcriptId: req.params.id
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production'
        ? 'An error occurred fetching the transcript'
        : error.message
    });
  }
});

module.exports = router;

