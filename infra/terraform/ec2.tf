# EC2 GPU Instance for Ollama

# Read userdata script
locals {
  ollama_userdata = file("${path.module}/olama_userdata.sh")
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "ec2_ollama" {
  name = "${local.project_prefix}-ec2-ollama-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-ec2-ollama-role"
    }
  )
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_ollama" {
  name = "${local.project_prefix}-ec2-ollama-profile"
  role = aws_iam_role.ec2_ollama.name
}

# IAM Policy for EC2 to access S3 (for model weights)
resource "aws_iam_role_policy" "ec2_s3" {
  name = "${local.project_prefix}-ec2-s3-policy"
  role = aws_iam_role.ec2_ollama.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.static.arn,
          "${aws_s3_bucket.static.arn}/*"
        ]
      }
    ]
  })
}

# IAM Policy for CloudWatch Agent
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  role       = aws_iam_role.ec2_ollama.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# EC2 Instance
resource "aws_instance" "ollama" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ssh_key_name
  vpc_security_group_ids = [aws_security_group.ec2.id]
  subnet_id              = aws_subnet.private[0].id
  
  # Note: Public IP assignment depends on subnet's map_public_ip_on_launch setting
  # For admin access, consider using a bastion host instead

  iam_instance_profile = aws_iam_instance_profile.ec2_ollama.name

  user_data = local.ollama_userdata

  root_block_device {
    volume_type = "gp3"
    volume_size = 100
    encrypted   = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.project_prefix}-ollama-instance"
    }
  )
}

# Get latest Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/*/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

