/**
 * Calls API Client
 * 
 * Handles all API calls related to calls management
 */

// API URL configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_GATEWAY_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'https://px9q707kr6.execute-api.us-east-1.amazonaws.com/staging';

// Determine which API to use based on environment
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const BASE_URL = isProduction ? API_GATEWAY_BASE : API_URL;

/**
 * Fetch all calls with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 50)
 * @param {string} options.status - Filter by status
 * @param {string} options.lead_id - Filter by lead ID
 * @param {string} options.recording_status - Filter by recording status
 * @returns {Promise<Object>} Calls data with pagination
 */
export async function getCalls(options = {}) {
  const params = new URLSearchParams();
  
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.status) params.append('status', options.status);
  if (options.lead_id) params.append('lead_id', options.lead_id);
  if (options.recording_status) params.append('recording_status', options.recording_status);

  const queryString = params.toString();
  const url = `${BASE_URL}/api/v1/calls${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch calls' }));
      throw new Error(error.message || error.error || 'Failed to fetch calls');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching calls:', error);
    throw error;
  }
}

/**
 * Fetch a single call by ID
 * @param {string} callId - Call UUID
 * @returns {Promise<Object>} Call data with transcripts
 */
export async function getCallById(callId) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/calls/${callId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch call' }));
      throw new Error(error.message || error.error || 'Failed to fetch call');
    }

    const data = await response.json();
    return data.call;
  } catch (error) {
    console.error('Error fetching call:', error);
    throw error;
  }
}

