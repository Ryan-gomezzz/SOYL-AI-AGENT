/**
 * Summary Card Component
 * 
 * Displays LLM-generated call summaries
 * Industry standards:
 * - Expandable/collapsible view
 * - Formatted summary display
 * - Loading states
 * - Empty states
 */

import { useState } from 'react';

function SummaryCard({ summary, callId, leadId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If summary is a string, use it directly
  // If it's an object, extract the summary text
  const summaryText = typeof summary === 'string' 
    ? summary 
    : summary?.summary_text || summary?.text || summary?.content || 'No summary available';

  // Check if summary is long enough to need truncation
  const shouldTruncate = summaryText.length > 200;
  const displayText = isExpanded || !shouldTruncate 
    ? summaryText 
    : summaryText.substring(0, 200) + '...';

  // Format date if available
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Extract tags if available
  const tags = summary?.tags || summary?.categories || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">Call Summary</h3>
          </div>
          
          {summary?.created_at && (
            <p className="mt-1 text-xs text-gray-500">
              Generated: {formatDate(summary.created_at)}
            </p>
          )}
        </div>

        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 text-sm text-indigo-600 hover:text-indigo-900"
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Summary Text */}
      <div className="mt-4">
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {displayText}
          </p>
        </div>
      </div>

      {/* Metadata */}
      {(callId || leadId) && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500 space-x-4">
            {callId && (
              <span>Call ID: {callId.substring(0, 8)}...</span>
            )}
            {leadId && (
              <span>Lead ID: {leadId.substring(0, 8)}...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Summary List Component
 * 
 * Displays multiple summaries (for Week 3 when summaries are available)
 */
export function SummaryList({ summaries = [], callId = null, leadId = null }) {
  if (!summaries || summaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-gray-900">No summaries available</h3>
        <p className="mt-2 text-sm text-gray-500">
          Summaries will be generated after calls are processed by the LLM
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaries.map((summary, index) => (
        <SummaryCard
          key={summary.id || index}
          summary={summary}
          callId={callId}
          leadId={leadId}
        />
      ))}
    </div>
  );
}

export default SummaryCard;

