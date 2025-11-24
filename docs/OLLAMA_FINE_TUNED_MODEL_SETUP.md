# Ollama Fine-Tuned Model Setup Guide

## Overview

This guide explains how to add and use fine-tuned models with Ollama on the EC2 GPU instance. For initial setup, we use the standard Llama 3.2 8B model, but this guide covers the procedure for adding custom fine-tuned models.

## Prerequisites

- EC2 GPU instance running with Ollama installed
- SSH access to the EC2 instance
- Fine-tuned model file (GGUF format recommended)
- Sufficient storage space on the instance

## Current Setup

### Default Model: Llama 3.2 8B

The system is currently configured to use **Llama 3.2 8B** as the default model. This model provides:
- Good performance for general tasks
- Reasonable latency
- 8B parameters (manageable for most GPU instances)

### Model Name Format
- Standard model: `llama3.2:8b` or `llama3.2:latest`
- Fine-tuned model: Custom name (e.g., `soyl-ca-agent:latest`)

## Adding a Fine-Tuned Model

### Step 1: Prepare the Fine-Tuned Model

1. **Model Format**: Ensure your fine-tuned model is in GGUF format
   - Recommended quantization: Q4_K_M or Q5_K_M for balance of quality and speed
   - Full precision models work but require more memory

2. **Model Location**: 
   - Store model files in S3 bucket: `ai-ca-agent-staging-recordings-us-east-1/models/`
   - Or upload directly to EC2 instance

### Step 2: Upload Model to EC2 Instance

#### Option A: From S3 (Recommended)

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@<ec2-public-ip>

# Download model from S3
aws s3 cp s3://ai-ca-agent-staging-recordings-us-east-1/models/your-model.gguf \
    ~/models/your-model.gguf

# Set proper permissions
chmod 644 ~/models/your-model.gguf
```

#### Option B: Direct Upload via SCP

```bash
# From your local machine
scp -i your-key.pem your-model.gguf ec2-user@<ec2-public-ip>:~/models/
```

### Step 3: Create Modelfile for Fine-Tuned Model

Create a Modelfile to configure your fine-tuned model:

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@<ec2-public-ip>

# Create Modelfile
cat > ~/models/Modelfile.soyl-ca-agent <<EOF
FROM ~/models/your-model.gguf

# Set system prompt for CA agent
SYSTEM """You are a specialized AI assistant for Chartered Accountant firms. 
You help with client inquiries, provide tax advice, and assist with financial 
consultation. Always be professional, accurate, and helpful."""

# Set parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096
EOF
```

### Step 4: Import Model into Ollama

```bash
# Import the model using the Modelfile
ollama create soyl-ca-agent -f ~/models/Modelfile.soyl-ca-agent

# Verify model is imported
ollama list
```

### Step 5: Test the Fine-Tuned Model

```bash
# Test with a simple query
ollama run soyl-ca-agent "What services do you provide for CA firms?"

# Or via API
curl http://localhost:11434/api/generate -d '{
  "model": "soyl-ca-agent",
  "prompt": "What services do you provide for CA firms?",
  "stream": false
}'
```

### Step 6: Update Application Configuration

Update the backend/worker service to use the new model:

```javascript
// In services/backend/src/config/llm.js or similar
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'soyl-ca-agent:latest';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://<ec2-private-ip>:11434';
```

Set environment variable in ECS task definition:
```json
{
  "name": "OLLAMA_MODEL",
  "value": "soyl-ca-agent:latest"
}
```

## Model Management

### List Available Models

```bash
# SSH into EC2 instance
ollama list

# Or via API
curl http://localhost:11434/api/tags
```

### Remove a Model

```bash
ollama rm soyl-ca-agent
```

### Pull Standard Models

```bash
# Pull Llama 3.2 8B (if not already present)
ollama pull llama3.2:8b

# Pull other models
ollama pull llama3.2:latest
ollama pull mistral:latest
```

## Fine-Tuning Workflow

### 1. Training Phase (External)

Fine-tune your model using your preferred framework:
- **LlamaFactory**: Recommended for Llama models
- **Unsloth**: Fast fine-tuning
- **Axolotl**: Comprehensive fine-tuning

### 2. Conversion to GGUF

Convert your fine-tuned model to GGUF format:

```bash
# Using llama.cpp
python convert.py <your-model-dir> --outtype gguf

# Quantize the model
./quantize <model-f32.gguf> <model-q4_k_m.gguf> Q4_K_M
```

### 3. Upload and Deploy

Follow Steps 2-6 above to deploy the fine-tuned model.

## Performance Optimization

### Model Quantization

For better performance, use quantized models:
- **Q4_K_M**: Good balance (recommended)
- **Q5_K_M**: Better quality, slightly slower
- **Q8_0**: Best quality, slower and larger
- **F16**: Full precision, slowest

### GPU Memory Management

```bash
# Check GPU memory usage
nvidia-smi

# Set Ollama to use specific GPU
export CUDA_VISIBLE_DEVICES=0
ollama serve
```

### Model Caching

Ollama automatically caches models. To clear cache:

```bash
# Remove unused models
ollama rm <model-name>

# Clear all cached models (careful!)
rm -rf ~/.ollama/models
```

## Monitoring and Logging

### Check Ollama Logs

```bash
# View Ollama service logs
sudo journalctl -u ollama -f

# Or if running manually
tail -f ~/.ollama/logs/server.log
```

### Monitor API Usage

```bash
# Test API health
curl http://localhost:11434/api/tags

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "soyl-ca-agent",
  "prompt": "Test prompt",
  "stream": false
}'
```

## Troubleshooting

### Model Not Loading

1. Check model file exists and is readable:
   ```bash
   ls -lh ~/models/your-model.gguf
   ```

2. Verify GGUF format:
   ```bash
   file ~/models/your-model.gguf
   ```

3. Check Ollama logs for errors

### Out of Memory Errors

1. Use a smaller quantized model (Q4_K_M instead of Q8_0)
2. Reduce `num_ctx` parameter in Modelfile
3. Ensure sufficient GPU memory available

### Slow Performance

1. Check GPU utilization: `nvidia-smi`
2. Use quantized models
3. Reduce context window size
4. Consider using a smaller model variant

## Security Considerations

### Network Access

- Ollama API should only be accessible from:
  - ECS tasks (via private IP)
  - Bastion host (for management)
- Use security groups to restrict access
- Consider using VPC endpoints for S3 access

### Model Storage

- Store models in S3 with encryption
- Use IAM roles for EC2 to access S3
- Don't commit model files to git

## Best Practices

1. **Version Control**: Tag your fine-tuned models with versions
   ```bash
   ollama create soyl-ca-agent:v1.0 -f Modelfile.soyl-ca-agent
   ```

2. **Backup Models**: Keep backups in S3
   ```bash
   aws s3 cp ~/models/your-model.gguf \
       s3://ai-ca-agent-staging-recordings-us-east-1/models/backups/
   ```

3. **Testing**: Always test new models before deploying to production
   ```bash
   # Test with sample prompts
   ollama run soyl-ca-agent:test "Your test prompt"
   ```

4. **Monitoring**: Monitor model performance and latency
   - Track response times
   - Monitor GPU usage
   - Log model usage

## Current Configuration

### Default Model
- **Model**: `llama3.2:8b`
- **Location**: EC2 GPU instance
- **API Endpoint**: `http://<ec2-private-ip>:11434`

### Environment Variables
```bash
OLLAMA_MODEL=llama3.2:8b
OLLAMA_BASE_URL=http://<ec2-private-ip>:11434
OLLAMA_TIMEOUT=30000
```

## Next Steps

1. Fine-tune model on your CA firm dataset
2. Convert to GGUF format
3. Upload to S3
4. Follow steps above to deploy
5. Update application configuration
6. Test thoroughly before production use

## References

- [Ollama Documentation](https://github.com/ollama/ollama)
- [Llama.cpp GGUF Format](https://github.com/ggerganov/llama.cpp)
- [Model Quantization Guide](https://github.com/ggerganov/llama.cpp#quantization)

