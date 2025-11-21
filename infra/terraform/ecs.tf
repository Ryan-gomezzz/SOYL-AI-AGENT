# ECS Cluster and Service Configuration

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.project_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-ecs-cluster"
    }
  )
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.project_prefix}"
  retention_in_days = 7

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-ecs-logs"
    }
  )
}

# ECS Service (skeleton - task definition will be created separately)
# Note: This is a placeholder service definition. The actual task definition
# should be created after the Docker image is built and pushed to ECR.
resource "aws_ecs_service" "backend" {
  name            = "${local.project_prefix}-backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  # Placeholder - will be configured after ALB is created
  # load_balancer {
  #   target_group_arn = aws_lb_target_group.backend.arn
  #   container_name   = "backend"
  #   container_port   = 3000
  # }

  depends_on = [
    aws_ecs_task_definition.backend
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-backend-service"
    }
  )
}

# ECS Task Definition (skeleton - will be updated with actual image URI)
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.project_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"

  execution_role_arn = aws_iam_role.ecs_task_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "backend"
      image = "${aws_ecr_repository.backend.repository_url}:latest"
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "DB_SECRET_ARN"
          value = aws_secretsmanager_secret.db_credentials.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }

      # Health check placeholder
      # healthCheck = {
      #   command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      #   interval    = 30
      #   timeout     = 5
      #   retries     = 3
      #   startPeriod = 60
      # }
    }
  ])

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-backend-task"
    }
  )
}

