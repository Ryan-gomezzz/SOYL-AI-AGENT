# RDS PostgreSQL Database Configuration

# Random password for RDS (will be stored in Secrets Manager)
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# AWS Secrets Manager secret for RDS credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.project_prefix}-rds-credentials"
  description = "RDS database credentials for ${local.project_prefix}"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-rds-secret"
    }
  )
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.main.address
    port     = 5432
    dbname   = var.db_name
  })
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.project_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-db-subnet-group"
    }
  )
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier             = "${local.project_prefix}-db"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  storage_type           = "gp3"
  storage_encrypted       = true
  
  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Backup configuration
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  # Multi-AZ disabled for staging (enable for production)
  multi_az = false

  # Deletion protection (disable for staging, enable for production)
  deletion_protection = false
  skip_final_snapshot = true

  # Performance insights
  performance_insights_enabled = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-rds"
    }
  )

  depends_on = [aws_secretsmanager_secret_version.db_credentials]
}

