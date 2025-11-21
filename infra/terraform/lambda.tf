# Lambda Function and API Gateway Configuration

# Lambda Function for Enquiry Handler
resource "aws_lambda_function" "enquiry_handler" {
  filename         = "${path.module}/../../services/lambda/enquiry-handler.zip"
  function_name    = "${local.project_prefix}-enquiry-handler"
  role            = aws_iam_role.lambda_execution.arn
  handler         = "handler.enquiry"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256

  # Placeholder zip file - actual code will be deployed via CI/CD
  # For now, create a minimal zip with placeholder code
  source_code_hash = fileexists("${path.module}/../../services/lambda/enquiry-handler.zip") ? filebase64sha256("${path.module}/../../services/lambda/enquiry-handler.zip") : "placeholder"

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

