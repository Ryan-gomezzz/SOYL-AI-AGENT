# Edge Cases Handled

This document outlines all edge cases that have been comprehensively handled across the application to ensure production-ready robustness.

## Database Connection Module (`services/backend/src/config/database.js`)

### Connection Pool Management
- ✅ **Pool Initialization Race Conditions**: Prevents concurrent initialization attempts
- ✅ **Connection Pool Exhaustion**: Configurable pool limits (max/min clients)
- ✅ **Dead Connection Detection**: Keepalive and health checks
- ✅ **Connection Timeout**: Configurable connection timeout with retries
- ✅ **Query Timeout**: Statement and query-level timeouts (default 30s)
- ✅ **Pool Cleanup**: Graceful pool closure on shutdown

### Secrets Manager Integration
- ✅ **Missing Secret ARN**: Fallback to environment variables (development only)
- ✅ **Secret Fetch Failures**: Retry logic with exponential backoff (3 retries)
- ✅ **Invalid Secret Format**: Validation of required fields (host, username, password)
- ✅ **Transient AWS Errors**: Retry on throttling, service unavailable, 500/503 errors
- ✅ **Network Timeouts**: Connection timeout handling with retries

### Query Execution
- ✅ **Slow Query Detection**: Logs queries taking > 1 second (production)
- ✅ **Query Timeout**: Race condition protection with Promise.race
- ✅ **Connection Errors**: Automatic pool reset on connection errors
- ✅ **Retryable Errors**: Retry on ECONNRESET, ETIMEDOUT, ENOTFOUND
- ✅ **Transaction Rollback**: Guaranteed rollback on transaction failure
- ✅ **Deadlock Handling**: Retry on serialization failures and deadlocks (40001, 40P01)
- ✅ **Statement Timeout**: Prevents runaway queries

### Error Handling
- ✅ **PostgreSQL Error Codes**: Specific handling for unique violations (23505), foreign keys (23503), check constraints (23514)
- ✅ **Connection Pool Errors**: Non-fatal error logging without process exit
- ✅ **Graceful Degradation**: Fail-open approach where appropriate

## Enquiry Routes (`services/backend/src/routes/enquiry.js`)

### Input Validation
- ✅ **Name Validation**: Length (1-255), character validation (letters, spaces, apostrophes, hyphens, periods)
- ✅ **Email Validation**: Format validation, normalization, length limit (255), disposable email detection
- ✅ **Phone Validation**: International format support (7-15 digits), sanitization
- ✅ **Enquiry Type**: Length limit (100), character validation
- ✅ **Notes**: Length limit (5000), SQL injection prevention
- ✅ **Source**: Length limit (100), character validation

### Database Operations
- ✅ **UUID Collision**: Retry mechanism (up to 5 attempts) for extremely rare UUID collisions
- ✅ **Duplicate Email Detection**: Pre-insert check with 409 Conflict response
- ✅ **Transaction Safety**: All inserts within transactions with rollback on error
- ✅ **Database Constraint Violations**: Specific error handling for:
  - Unique violations (23505) → 409 Conflict
  - Foreign key violations (23503) → 400 Bad Request
  - Check constraint violations (23514) → 400 Bad Request
  - Not null violations (23502) → 400 Bad Request
- ✅ **Empty Result Sets**: Validation that INSERT returned a row

### Error Handling
- ✅ **Query Timeout**: 504 Gateway Timeout response
- ✅ **Connection Errors**: 503 Service Unavailable response
- ✅ **Generic Errors**: 500 Internal Server Error with sanitized messages (production)
- ✅ **Validation Errors**: 400 Bad Request with detailed field errors

### Email Integration
- ✅ **Non-Blocking Email**: Email sending doesn't block API response
- ✅ **Email Failure Graceful**: Lead creation succeeds even if email fails
- ✅ **Email Error Logging**: Comprehensive error logging for email failures

## Leads Routes (`services/backend/src/routes/leads.js`)

### Pagination
- ✅ **Invalid Page Number**: Validation (min: 1), default fallback
- ✅ **Invalid Limit**: Validation (min: 1, max: 100), default/clamp fallback
- ✅ **Large Offset Protection**: Maximum offset limit (10,000) to prevent performance issues
- ✅ **Page Exceeds Total Pages**: Validation with helpful error message
- ✅ **Negative/Zero Values**: Validation and sanitization
- ✅ **NaN Values**: Validation with default fallback

### Filtering & Search
- ✅ **SQL Injection Prevention**: All filters use parameterized queries
- ✅ **Status Validation**: Whitelist of valid statuses (pending, contacted, converted, rejected, archived)
- ✅ **Source Sanitization**: Character sanitization (alphanumeric, underscore, hyphen)
- ✅ **Search Length Limit**: Maximum 100 characters for search terms
- ✅ **Search Minimum Length**: Minimum 2 characters for search (prevents performance issues)
- ✅ **Special Characters**: Stripped from filter values
- ✅ **Case-Insensitive Search**: Search in name and email fields

### Query Execution
- ✅ **Parallel Query Execution**: Count and data queries run in parallel
- ✅ **Empty Results**: Handled gracefully (empty array, not error)
- ✅ **Timeout Protection**: Separate timeouts for count (5s) and data (10s) queries
- ✅ **Connection Errors**: 503 Service Unavailable response
- ✅ **Query Timeout**: 504 Gateway Timeout response with helpful message

### Data Validation
- ✅ **UUID Validation**: Strict UUID v4 format validation
- ✅ **Result Set Validation**: Null/undefined result handling
- ✅ **Integer Parsing**: Safe integer parsing with fallback

## Email Service (`services/backend/src/services/email.js`)

### Email Validation
- ✅ **Recipient Validation**: Required field validation
- ✅ **Email Format Validation**: Regex validation for all addresses
- ✅ **Subject Validation**: Required field validation
- ✅ **Body Validation**: HTML or text body required

### AWS SES Integration
- ✅ **MessageRejected Errors**: Specific error handling
- ✅ **Domain Verification**: MailFromDomainNotVerifiedException handling
- ✅ **Configuration Set Errors**: ConfigurationSetDoesNotExistException handling
- ✅ **Retry Logic**: Exponential backoff for transient errors (Throttling, ServiceUnavailable, 500/503)
- ✅ **Network Errors**: Retry on ECONNRESET, ETIMEDOUT
- ✅ **Rate Limiting**: Throttling error detection and retry

### Template Rendering
- ✅ **Template Load Failures**: Graceful fallback to default HTML template
- ✅ **Missing Template Variables**: Placeholder replacement with empty strings
- ✅ **Template Path Errors**: Comprehensive error handling

### Email Sending
- ✅ **Multiple Recipients**: Support for To, Cc, Bcc arrays
- ✅ **Reply-To Address**: Configurable reply-to address
- ✅ **Configuration Set**: Optional SES configuration set
- ✅ **Character Encoding**: UTF-8 charset for all email components

## Server Startup (`services/backend/src/index.js`)

### Server Initialization
- ✅ **Port Already in Use**: Specific error handling (EADDRINUSE) with clear message
- ✅ **Server Errors**: Comprehensive error handling and logging
- ✅ **Database Initialization Failures**: Non-blocking migration errors
- ✅ **Migration Failures**: Non-fatal migration errors (migrations can run separately)

### Graceful Shutdown
- ✅ **SIGTERM Handling**: Graceful server and database pool closure
- ✅ **SIGINT Handling**: Graceful server and database pool closure
- ✅ **Server Close Timeout**: Timeout protection for server closure
- ✅ **Pool Close Timeout**: Timeout protection for pool closure
- ✅ **Duplicate Shutdown Prevention**: Flags to prevent multiple shutdown attempts

## Health Checks

### Database Health
- ✅ **Connection Test**: SELECT 1 query with timeout
- ✅ **Health Status Codes**: 200 OK (healthy) vs 503 Service Unavailable (unhealthy)
- ✅ **Error Reporting**: Database errors included in health response (development)

## General Patterns

### Retry Logic
- ✅ **Exponential Backoff**: `delay = base * 2^attempt`
- ✅ **Maximum Retries**: Configurable max retries (typically 3)
- ✅ **Retryable Errors**: Specific error code detection
- ✅ **Non-Retryable Errors**: Immediate failure for non-retryable errors

### Timeout Protection
- ✅ **Query Timeouts**: Promise.race pattern for timeout protection
- ✅ **Connection Timeouts**: Configurable connection timeouts
- ✅ **HTTP Request Timeouts**: Express request timeout middleware

### Error Logging
- ✅ **Sensitive Data Masking**: Partial email/ID logging in production
- ✅ **Structured Logging**: Consistent error log format
- ✅ **Error Context**: Include relevant context (query, parameters, etc.)

### Security
- ✅ **SQL Injection Prevention**: All queries use parameterized statements
- ✅ **Input Sanitization**: Character stripping and validation
- ✅ **Environment-Based Behavior**: Different error messages for production vs development
- ✅ **Secrets Protection**: No secrets in logs or error messages

### Performance
- ✅ **Slow Query Detection**: Logging of queries > 1 second
- ✅ **Connection Pooling**: Reuse of database connections
- ✅ **Parallel Query Execution**: Promise.all for independent queries
- ✅ **Result Set Limits**: Pagination and LIMIT clauses

## Testing Recommendations

To verify edge case handling, test:

1. **Database Connection Failures**: Kill database connection mid-query
2. **Network Timeouts**: Simulate slow network or timeout scenarios
3. **Invalid Input**: Send malformed requests with various edge cases
4. **Concurrent Requests**: Test race conditions with parallel requests
5. **Resource Exhaustion**: Test with connection pool limits
6. **Graceful Shutdown**: Test SIGTERM/SIGINT handling
7. **Email Failures**: Test SES errors and retry logic
8. **Large Datasets**: Test pagination with large result sets
9. **UUID Collision**: Simulate UUID collision (extremely rare but handled)
10. **Transaction Failures**: Test rollback scenarios

## Configuration

All timeout and retry values are configurable via environment variables:

```bash
# Database
DB_POOL_MAX=10
DB_POOL_MIN=2
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000

# Email
MAX_RETRIES=3
RETRY_DELAY=1000

# Server
PORT=3000
```

## Conclusion

All critical edge cases have been handled with:
- **Defensive Programming**: Validation and sanitization at every layer
- **Graceful Degradation**: Fail-open where appropriate, fail-fast where critical
- **Comprehensive Error Handling**: Specific handling for known error conditions
- **Production-Ready Logging**: Structured logging without exposing sensitive data
- **Performance Protection**: Timeouts, limits, and connection pooling
- **Security**: SQL injection prevention, input validation, secrets protection

The application is production-ready with robust error handling and edge case coverage.

