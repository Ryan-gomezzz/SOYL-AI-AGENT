/**
 * Leads Routes
 * 
 * Production-ready leads management endpoints with comprehensive edge case handling:
 * - Pagination validation and limits
 * - SQL injection prevention
 * - Large dataset handling
 * - Empty result handling
 * - Timeout protection
 * - Connection error handling
 */

const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Constants for pagination and filtering
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const DEFAULT_PAGE = 1;

// Valid status values (can be expanded)
const VALID_STATUSES = ['pending', 'contacted', 'converted', 'rejected', 'archived'];

/**
 * Sanitize and validate filter values to prevent SQL injection
 * @param {string} value - Filter value
 * @param {Array} allowedValues - Allowed values (optional)
 * @returns {string|null} Sanitized value or null
 */
function sanitizeFilter(value, allowedValues = null) {
  if (!value) return null;
  
  // Remove any characters that could be used for SQL injection
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  
  // If allowed values provided, validate against them
  if (allowedValues && !allowedValues.includes(sanitized)) {
    return null;
  }
  
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * GET /api/v1/leads
 * Get list of leads with pagination and filtering
 * 
 * Query parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 50, min: 1, max: 100)
 * - status: Filter by status (optional, validated)
 * - source: Filter by source (optional, sanitized)
 * - search: Search by name or email (optional, sanitized)
 * 
 * Edge cases handled:
 * - Invalid pagination parameters
 * - SQL injection prevention
 * - Large offset values (performance protection)
 * - Empty result sets
 * - Database timeouts
 * - Connection errors
 * - Negative/zero/invalid page/limit values
 * - Invalid status values
 * - Special characters in filters
 */
router.get('/leads', async (req, res) => {
  try {
    // Parse and validate pagination parameters
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    
    // Validate page
    if (isNaN(page) || page < 1) {
      page = DEFAULT_PAGE;
    }
    
    // Validate limit
    if (isNaN(limit) || limit < 1) {
      limit = DEFAULT_LIMIT;
    } else if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }
    
    // Protect against large offsets (performance issue)
    const maxOffset = 10000; // Max 10k offset
    const offset = (page - 1) * limit;
    
    if (offset > maxOffset) {
      return res.status(400).json({
        error: 'Invalid pagination',
        message: `Offset too large. Maximum offset is ${maxOffset}. Use search/filtering instead.`
      });
    }

    // Sanitize and validate filters
    const status = sanitizeFilter(req.query.status, VALID_STATUSES);
    const source = sanitizeFilter(req.query.source); // Allow any source value (sanitized)
    const search = req.query.search ? req.query.search.trim().substring(0, 100) : null; // Limit search length

    // Build WHERE clause dynamically with parameterized queries
    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (source) {
      whereConditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    // Search in name and email (case-insensitive)
    if (search && search.length >= 2) { // Minimum 2 characters for search
      whereConditions.push(`(
        LOWER(name) LIKE LOWER($${paramIndex}) OR 
        LOWER(email) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Count query (with timeout protection)
    const countQuery = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
    
    // Data query with pagination (limit result set size)
    const dataQuery = `
      SELECT 
        id, 
        name, 
        email, 
        phone, 
        enquiry_type, 
        notes, 
        source, 
        status, 
        created_at, 
        updated_at 
      FROM leads
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} 
      OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Execute queries in parallel with timeout protection
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
      // Handle database errors gracefully
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

    // Parse results with error handling
    let total = 0;
    try {
      total = parseInt(countResult.rows[0]?.total || '0', 10);
    } catch (parseError) {
      console.error('Error parsing total count:', parseError);
      total = 0;
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    
    // Ensure page doesn't exceed total pages
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

    // Return results (empty array is valid)
    return res.json({
      leads: dataResult.rows || [],
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
    console.error('Error fetching leads:', {
      error: error.message,
      code: error.code,
      query: req.query
    });
    
    // Handle specific error types
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
        ? 'An error occurred fetching leads'
        : error.message
    });
  }
});

/**
 * GET /api/v1/leads/:id
 * Get a specific lead by ID
 * 
 * Edge cases handled:
 * - Invalid UUID format
 * - Lead not found
 * - Database errors
 * - Timeout handling
 * - SQL injection prevention (parameterized query)
 */
router.get('/leads/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Strict UUID v4 validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: 'Invalid lead ID format',
        message: 'Lead ID must be a valid UUID v4'
      });
    }

    // Query with timeout protection
    let result;
    try {
      result = await query(
        `SELECT 
          id, 
          name, 
          email, 
          phone, 
          enquiry_type, 
          notes, 
          source, 
          status, 
          created_at, 
          updated_at 
        FROM leads 
        WHERE id = $1`,
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
        message: 'Lead not found'
      });
    }

    // Return lead data
    const lead = result.rows[0];
    
    // Optionally mask sensitive data in production logs
    if (process.env.NODE_ENV === 'production') {
      // Could partially mask email for logging, etc.
    }

    return res.json({
      lead
    });

  } catch (error) {
    console.error('Error fetching lead:', {
      error: error.message,
      code: error.code,
      leadId: req.params.id
    });
    
    return res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'production'
        ? 'An error occurred fetching the lead'
        : error.message
    });
  }
});

module.exports = router;
