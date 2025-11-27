# Lambda Function and API Gateway Configuration

# Lambda Function for Enquiry Handler
resource "aws_lambda_function" "enquiry_handler" {
  filename         = "${path.module}/../../services/lambda/enquiry-handler.zip"
  function_name    = "${local.project_prefix}-enquiry-handler"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.enquiry"
  runtime         = "nodejs20.x"
  timeout         = 30
  memory_size     = 256

  # Placeholder zip file - actual code will be deployed via CI/CD
  # For now, create a minimal zip with placeholder code
  source_code_hash = fileexists("${path.module}/../../services/lambda/enquiry-handler.zip") ? filebase64sha256("${path.module}/../../services/lambda/enquiry-handler.zip") : "placeholder"

  # VPC Configuration for RDS access
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      S3_BUCKET_RECORDINGS = aws_s3_bucket.recordings.id
      S3_BUCKET_TRANSCRIPTS = aws_s3_bucket.transcripts.id
      ENVIRONMENT = var.environment
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-enquiry-handler"
    }
  )
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_enquiry" {
  name              = "/aws/lambda/${aws_lambda_function.enquiry_handler.function_name}"
  retention_in_days = 7

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-lambda-enquiry-logs"
    }
  )
}

# API Gateway HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.project_prefix}-api"
  protocol_type = "HTTP"
  description   = "API Gateway for ${local.project_prefix}"

  cors_configuration {
    allow_origins = ["*"] # TODO: Restrict to specific origins in production
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type", "x-amz-date", "authorization", "x-api-key"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-api"
    }
  )
}

# API Gateway Integration
resource "aws_apigatewayv2_integration" "enquiry" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  integration_method = "POST"
  integration_uri    = aws_lambda_function.enquiry_handler.invoke_arn
}

# API Gateway Route
resource "aws_apigatewayv2_route" "enquiry" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /enquiry"
  target    = "integrations/${aws_apigatewayv2_integration.enquiry.id}"
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = 100
    throttling_burst_limit = 200
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-api-stage"
    }
  )
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.enquiry_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# Lambda Function for Connect Events and S3 Recording Processing
resource "aws_lambda_function" "connect_handler" {
  filename         = "${path.module}/../../services/lambda/connect-handler.zip"
  function_name    = "${local.project_prefix}-connect-handler"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "connect-handler.handler"
  runtime         = "nodejs20.x"
  timeout         = 60
  memory_size     = 512

  source_code_hash = fileexists("${path.module}/../../services/lambda/connect-handler.zip") ? filebase64sha256("${path.module}/../../services/lambda/connect-handler.zip") : "placeholder"

  # VPC Configuration for RDS access
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      S3_BUCKET_RECORDINGS = aws_s3_bucket.recordings.id
      ENVIRONMENT = var.environment
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-connect-handler"
    }
  )
}

# CloudWatch Log Group for Connect Lambda
resource "aws_cloudwatch_log_group" "lambda_connect" {
  name              = "/aws/lambda/${aws_lambda_function.connect_handler.function_name}"
  retention_in_days = 7

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-lambda-connect-logs"
    }
  )
}

# Lambda Permission for S3 to invoke Connect handler
resource "aws_lambda_permission" "s3_connect_handler" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect_handler.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.recordings.arn
}

# Lambda Function for Batch Transcribe Worker (Week 2 - Engineer B)
resource "aws_lambda_function" "transcribe_worker" {
  filename         = "${path.module}/../../services/worker/transcribe-worker.zip"
  function_name    = "${local.project_prefix}-transcribe-worker"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "lambda-handler.handler"
  runtime         = "nodejs20.x"
  timeout         = 900  # 15 minutes (max for Lambda)
  memory_size     = 512

  source_code_hash = fileexists("${path.module}/../../services/worker/transcribe-worker.zip") ? filebase64sha256("${path.module}/../../services/worker/transcribe-worker.zip") : "placeholder"

  # VPC Configuration for RDS access
  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.db_credentials.arn
      S3_BUCKET_RECORDINGS = aws_s3_bucket.recordings.id
      S3_BUCKET_TRANSCRIPTS = aws_s3_bucket.transcripts.id
      RECORDINGS_BUCKET = aws_s3_bucket.recordings.id
      TRANSCRIPTS_BUCKET = aws_s3_bucket.transcripts.id
      ENVIRONMENT = var.environment
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-transcribe-worker"
    }
  )
}

# CloudWatch Log Group for Transcribe Worker Lambda
resource "aws_cloudwatch_log_group" "lambda_transcribe" {
  name              = "/aws/lambda/${aws_lambda_function.transcribe_worker.function_name}"
  retention_in_days = 7

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-lambda-transcribe-logs"
    }
  )
}

# Lambda Permission for S3 to invoke Transcribe worker
resource "aws_lambda_permission" "s3_transcribe_worker" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.transcribe_worker.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.recordings.arn
}

# S3 Event Notification for Recordings Bucket
resource "aws_s3_bucket_notification" "recordings_notification" {
  bucket = aws_s3_bucket.recordings.id

  # Twilio recordings (new)
  lambda_function {
    lambda_function_arn = aws_lambda_function.transcribe_worker.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "twilio-recordings/"
    filter_suffix       = ".wav"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.transcribe_worker.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "twilio-recordings/"
    filter_suffix       = ".mp3"
  }

  # Legacy Connect recordings (deprecated, but kept for backward compatibility)
  lambda_function {
    lambda_function_arn = aws_lambda_function.connect_handler.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "connect-recordings/"
    filter_suffix       = ".wav"
  }

  lambda_function {
    lambda_function_arn = aws_lambda_function.connect_handler.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "connect-recordings/"
    filter_suffix       = ".mp3"
  }

  depends_on = [
    aws_lambda_permission.s3_connect_handler,
    aws_lambda_permission.s3_transcribe_worker
  ]
}

