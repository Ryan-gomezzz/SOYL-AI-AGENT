/**
 * Enquiry Form Page
 * 
 * Form for submitting new lead enquiries
 */

import { useState } from 'react';
import { submitEnquiry } from '../api/leads';

function EnquiryForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    enquiry_type: '',
    notes: '',
  });
  
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [leadId, setLeadId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user types
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    setError('');
    setLeadId('');

    try {
      const response = await submitEnquiry(formData);
      setStatus('success');
      setLeadId(response.lead_id);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        enquiry_type: '',
        notes: '',
      });

      // Clear success message after 5 seconds
      setTimeout(() => {
        setStatus('');
        setLeadId('');
      }, 5000);
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Failed to submit enquiry. Please try again.');
    }
  };

  const enquiryTypes = [
    { value: '', label: 'Select enquiry type...' },
    { value: 'General Inquiry', label: 'General Inquiry' },
    { value: 'Tax Consultation', label: 'Tax Consultation' },
    { value: 'Accounting Services', label: 'Accounting Services' },
    { value: 'Audit Services', label: 'Audit Services' },
    { value: 'Business Advisory', label: 'Business Advisory' },
    { value: 'Other', label: 'Other' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Enquiry</h1>
        <p className="mt-1 text-sm text-gray-500">
          Submit a new lead enquiry. We'll get back to you shortly.
        </p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your full name"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your email address"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your phone number"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional. Include country code (e.g., +1 234 567 8900)
            </p>
          </div>

          {/* Enquiry Type */}
          <div>
            <label htmlFor="enquiry_type" className="block text-sm font-medium text-gray-700 mb-1">
              Enquiry Type
            </label>
            <select
              id="enquiry_type"
              name="enquiry_type"
              value={formData.enquiry_type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {enquiryTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Provide any additional information about your enquiry..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional. Maximum 5000 characters.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit Enquiry'}
            </button>
          </div>
        </form>

        {/* Success Message */}
        {status === 'success' && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-green-800">
                  Enquiry submitted successfully!
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Your enquiry has been received. Lead ID: <span className="font-mono font-medium">{leadId}</span>
                </p>
                <p className="mt-2 text-sm text-green-700">
                  A confirmation email has been sent to {formData.email || 'your email address'}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {status === 'error' && error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Information</h3>
            <p className="mt-1 text-sm text-blue-700">
              Fields marked with <span className="text-red-500">*</span> are required.
              After submission, you'll receive a confirmation email and your enquiry will be visible in the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnquiryForm;

