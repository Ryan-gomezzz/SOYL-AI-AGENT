/**
 * Leads API Client
 * 
 * Handles all API calls related to leads management
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Fetch all leads with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 50)
 * @param {string} options.status - Filter by status
 * @param {string} options.source - Filter by source
 * @param {string} options.search - Search term
 * @returns {Promise<Object>} Leads data with pagination
 */
export async function getLeads(options = {}) {
  const params = new URLSearchParams();
  
  if (options.page) params.append('page', options.page);
  if (options.limit) params.append('limit', options.limit);
  if (options.status) params.append('status', options.status);
  if (options.source) params.append('source', options.source);
  if (options.search) params.append('search', options.search);

  const queryString = params.toString();
  const url = `${API_URL}/api/v1/leads${queryString ? `?${queryString}` : ''}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch leads' }));
      throw new Error(error.message || error.error || 'Failed to fetch leads');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
}

/**
 * Fetch a single lead by ID
 * @param {string} leadId - Lead UUID
 * @returns {Promise<Object>} Lead data
 */
export async function getLeadById(leadId) {
  try {
    const response = await fetch(`${API_URL}/api/v1/leads/${leadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch lead' }));
      throw new Error(error.message || error.error || 'Failed to fetch lead');
    }

    const data = await response.json();
    return data.lead;
  } catch (error) {
    console.error('Error fetching lead:', error);
    throw error;
  }
}

/**
 * Submit an enquiry to create a new lead
 * @param {Object} enquiryData - Enquiry data
 * @param {string} enquiryData.name - Name
 * @param {string} enquiryData.email - Email
 * @param {string} enquiryData.phone - Phone (optional)
 * @param {string} enquiryData.enquiry_type - Enquiry type (optional)
 * @param {string} enquiryData.notes - Notes (optional)
 * @returns {Promise<Object>} Response with lead_id
 */
export async function submitEnquiry(enquiryData) {
  try {
    const response = await fetch(`${API_URL}/api/v1/enquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enquiryData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to submit enquiry' }));
      throw new Error(error.message || error.error || 'Failed to submit enquiry');
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting enquiry:', error);
    throw error;
  }
}

