/**
 * Lambda Handler for Transcribe Worker
 * 
 * This is the entry point for the Lambda function.
 * It wraps the transcribe worker to work as a Lambda handler.
 */

const { processS3Event } = require('./src/transcribe-worker');

/**
 * Lambda handler function
 * 
 * @param {Object} event - S3 event from S3 bucket notification
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} Response object
 */
exports.handler = async (event, context) => {
  console.log('Lambda transcribe worker invoked');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    await processS3Event(event);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processing complete',
        requestId: context.requestId
      })
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        requestId: context.requestId
      })
    };
  }
};

