/**
 * Transcripts API Client
 * 
 * Handles all API calls related to transcripts management
 */

// API URL configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_GATEWAY_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'https://px9q707kr6.execute-api.us-east-1.amazonaws.com/staging';

// Determine which API to use based on environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const BASE_URL = isProduction ? API_GATEWAY_BASE : API_URL;

/**
 * Fetch all transcripts with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 50)
 * @param {string} options.call_id - Filter by call ID
 * @param {string} options.lead_id - Filter by lead ID
 * @param {string} options.search - Search in transcript text
 * @returns {Promise<Object>} Transcripts data with pagination
 */
export async function getTranscripts(options = {}) {
  const params = new URLSearchParams();
  
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.call_id) params.append('call_id', options.call_id);
  if (options.lead_id) params.append('lead_id', options.lead_id);
  if (options.search) params.append('search', options.search);

  const queryString = params.toString();
  const url = `${BASE_URL}/api/v1/transcripts${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch transcripts' }));
      throw new Error(error.message || error.error || 'Failed to fetch transcripts');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    throw error;
  }
}

/**
 * Fetch a single transcript by ID
 * @param {string} transcriptId - Transcript UUID
 * @returns {Promise<Object>} Transcript data with call and lead info
 */
export async function getTranscriptById(transcriptId) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/transcripts/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch transcript' }));
      throw new Error(error.message || error.error || 'Failed to fetch transcript');
    }

    const data = await response.json();
    return data.transcript;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

