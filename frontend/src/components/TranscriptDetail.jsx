/**
 * Transcript Detail Component
 * 
 * Displays full transcript details with call and lead information
 */

import { useState, useEffect } from 'react';
import { getTranscriptById } from '../api/transcripts';

function TranscriptDetail({ transcriptId, onBack }) {
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTranscript = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getTranscriptById(transcriptId);
        setTranscript(data);
      } catch (err) {
        setError(err.message || 'Failed to load transcript');
        console.error('Error fetching transcript:', err);
      } finally {
        setLoading(false);
      }
    };

    if (transcriptId) {
      fetchTranscript();
    }
  }, [transcriptId]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-sm text-gray-500">Loading transcript...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-sm font-medium text-gray-900">Error loading transcript</h3>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-500">Transcript not found</p>
        {onBack && (
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transcript Details</h2>
          <p className="mt-1 text-sm text-gray-500">Full transcript with call and lead information</p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ← Back to List
          </button>
        )}
      </div>

      {/* Call & Lead Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Call Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Lead Name</label>
            <p className="mt-1 text-sm text-gray-900">{transcript.lead_name || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Lead Email</label>
            <p className="mt-1 text-sm text-gray-900">{transcript.lead_email || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Phone Number</label>
            <p className="mt-1 text-sm text-gray-900">{transcript.phone_number || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Call Duration</label>
            <p className="mt-1 text-sm text-gray-900">{formatDuration(transcript.call_duration)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Call Status</label>
            <p className="mt-1 text-sm text-gray-900 capitalize">{transcript.call_status || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Call Date</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(transcript.started_at)}</p>
          </div>
        </div>
      </div>

      {/* Transcript Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transcript Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Language</label>
            <p className="mt-1 text-sm text-gray-900 uppercase">{transcript.language || 'EN'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Confidence Score</label>
            <p className="mt-1">
              {transcript.confidence_score ? (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  transcript.confidence_score >= 0.8 
                    ? 'bg-green-100 text-green-800' 
                    : transcript.confidence_score >= 0.6 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {(transcript.confidence_score * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-sm text-gray-400">-</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Created At</label>
            <p className="mt-1 text-sm text-gray-900">{formatDate(transcript.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Transcript Text */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transcript Text</h3>
        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {transcript.processed_transcript || transcript.raw_transcript || 'No transcript text available'}
          </p>
        </div>
      </div>

      {/* Raw Transcript (if different) */}
      {transcript.raw_transcript && transcript.processed_transcript && 
       transcript.raw_transcript !== transcript.processed_transcript && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Raw Transcript</h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcript.raw_transcript}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TranscriptDetail;

