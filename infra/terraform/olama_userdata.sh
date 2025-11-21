#!/bin/bash
# Userdata script for EC2 GPU instance running Ollama
# This script sets up Docker, Ollama, and CloudWatch agent

set -e

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Docker
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker service
systemctl enable docker
systemctl start docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install CloudWatch Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb

# Create CloudWatch agent configuration
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
  "metrics": {
    "namespace": "${PROJECT}-${ENVIRONMENT}/Ollama",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "totalcpu": false
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ]
      },
      "netstat": {
        "measurement": [
          "tcp_established",
          "tcp_time_wait"
        ]
      },
      "processes": {
        "measurement": [
          "running",
          "sleeping",
          "dead"
        ]
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/ollama.log",
            "log_group_name": "/ecs/${PROJECT}-${ENVIRONMENT}/ollama",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

# Pull Ollama Docker image
# Note: Model weights are NOT stored on EC2. They should be downloaded from S3 or external registry.
# This is a placeholder - actual Ollama setup will be done separately
docker pull ollama/ollama:latest || echo "Ollama image pull failed - will be configured manually"

# Create systemd service for Ollama (placeholder)
# The actual service configuration will be done after model weights are available
cat > /etc/systemd/system/ollama.service <<'SERVICEEOF'
[Unit]
Description=Ollama Service
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=ubuntu
ExecStart=/usr/bin/docker run --rm -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama:latest
ExecStop=/usr/bin/docker stop ollama
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable but don't start the service yet (wait for model weights)
systemctl daemon-reload
systemctl enable ollama.service

# Log completion
echo "Ollama EC2 instance setup completed at $(date)" >> /var/log/ollama-setup.log

# Note: Model weights should be downloaded from S3 or external registry before starting Ollama service
# Example command (to be run manually or via separate script):
# aws s3 sync s3://${PROJECT}-${ENVIRONMENT}-static/models/ollama/ /opt/ollama/models/

