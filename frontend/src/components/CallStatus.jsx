/**
 * Call Status Component
 * 
 * Displays call status indicators and filters
 * Industry standards:
 * - Color-coded status badges
 * - Status filters
 * - Duration display
 * - Timestamp formatting
 */

import { getCalls } from '../api/calls';
import { useState, useEffect } from 'react';

function CallStatus({ leadId = null, onCallSelect = null }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Status options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'initiated', label: 'Initiated' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // Fetch calls
  const fetchCalls = async () => {
    setLoading(true);
    setError(null);

    try {
      const options = {
        page: 1,
        limit: 100,
      };

      if (leadId) options.lead_id = leadId;
      if (statusFilter) options.status = statusFilter;

      const data = await getCalls(options);
      setCalls(data.calls || []);
    } catch (err) {
      setError(err.message || 'Failed to load calls');
      console.error('Error fetching calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [leadId, statusFilter]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status badge color and icon
  const getStatusBadge = (status) => {
    const statusConfig = {
      'initiated': {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'Initiated'
      },
      'in-progress': {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'In Progress'
      },
      'completed': {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'Completed'
      },
      'failed': {
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        label: 'Failed'
      },
      'cancelled': {
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: 'M6 18L18 6M6 6l12 12',
        label: 'Cancelled'
      },
    };

    return statusConfig[status] || statusConfig['initiated'];
  };

  // Get recording status badge
  const getRecordingStatusBadge = (recordingStatus) => {
    const statusConfig = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'available': { color: 'bg-green-100 text-green-800', label: 'Available' },
      'processing': { color: 'bg-blue-100 text-blue-800', label: 'Processing' },
      'failed': { color: 'bg-red-100 text-red-800', label: 'Failed' },
    };

    const config = statusConfig[recordingStatus] || { color: 'bg-gray-100 text-gray-800', label: recordingStatus || 'Unknown' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        <p className="mt-2 text-sm text-gray-500">Loading calls...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={fetchCalls}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-900"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Group calls by status
  const callsByStatus = calls.reduce((acc, call) => {
    const status = call.status || 'initiated';
    if (!acc[status]) acc[status] = [];
    acc[status].push(call);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statusOptions.filter(opt => opt.value).map((option) => {
          const statusCalls = callsByStatus[option.value] || [];
          const statusConfig = getStatusBadge(option.value);
          return (
            <div key={option.value} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-2 rounded-full ${statusConfig.color.replace('text-', 'bg-').split(' ')[0]}`}>
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusConfig.icon} />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">{statusConfig.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{statusCalls.length}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calls List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {calls.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No calls found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {statusFilter ? 'Try adjusting your filter' : 'No calls have been made yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recording
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {calls.map((call) => {
                  const statusConfig = getStatusBadge(call.status);
                  return (
                    <tr 
                      key={call.id} 
                      className={`hover:bg-gray-50 ${onCallSelect ? 'cursor-pointer' : ''}`}
                      onClick={() => onCallSelect && onCallSelect(call.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{call.lead_name || '-'}</div>
                        <div className="text-xs text-gray-500">{call.lead_email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{call.phone_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusConfig.icon} />
                          </svg>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRecordingStatusBadge(call.recording_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(call.call_duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(call.started_at || call.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallStatus;

