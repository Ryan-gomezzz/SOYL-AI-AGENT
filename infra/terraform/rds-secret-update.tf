# Update RDS secret with host after RDS is created
# This is a separate resource to avoid circular dependency

resource "aws_secretsmanager_secret_version" "db_credentials_updated" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    engine   = "postgres"
    host     = aws_db_instance.main.address
    port     = 5432
    dbname   = var.db_name
  })

  # This will replace the initial secret version after RDS is created
  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_db_instance.main]
}

