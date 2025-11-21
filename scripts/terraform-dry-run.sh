#!/bin/bash
# Terraform dry-run script
# Runs terraform init, validate, and plan, saving outputs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../infra/terraform"
PLANS_DIR="$TERRAFORM_DIR/plans"

echo "Starting Terraform dry-run..."

# Create plans directory if it doesn't exist
mkdir -p "$PLANS_DIR"

# Change to terraform directory
cd "$TERRAFORM_DIR"

# Check if terraform.tfvars exists
if [ ! -f terraform.tfvars ]; then
    echo "Warning: terraform.tfvars not found. Using terraform.tfvars.example as reference."
    echo "Please create terraform.tfvars with your values before running terraform apply."
fi

# Initialize Terraform
echo "Step 1: Initializing Terraform..."
terraform init

# Validate configuration
echo "Step 2: Validating Terraform configuration..."
if ! terraform validate; then
    echo "Error: Terraform validation failed. Please fix errors and try again."
    exit 1
fi

# Generate plan
echo "Step 3: Generating Terraform plan..."
terraform plan -out=tfplan

# Save plan in multiple formats
echo "Step 4: Saving plan outputs..."

# Human-readable plan
terraform show tfplan > "$PLANS_DIR/week1_plan.txt"
echo "  ✓ Saved human-readable plan to: $PLANS_DIR/week1_plan.txt"

# JSON plan
terraform show -json tfplan > "$PLANS_DIR/week1_plan.json"
echo "  ✓ Saved JSON plan to: $PLANS_DIR/week1_plan.json"

# Collect expected outputs (if plan has outputs)
echo "Step 5: Collecting expected outputs..."
terraform show -json tfplan | jq -r '.planned_values.outputs // {}' > "$PLANS_DIR/week1_outputs.json" 2>/dev/null || echo "{}" > "$PLANS_DIR/week1_outputs.json"
echo "  ✓ Saved expected outputs to: $PLANS_DIR/week1_outputs.json"

echo ""
echo "Terraform dry-run completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Review the plan: cat $PLANS_DIR/week1_plan.txt"
echo "  2. Add SES DNS records (see docs/deploy-steps.md)"
echo "  3. After review, run: terraform apply tfplan"
echo ""
echo "⚠️  IMPORTANT: Do not run 'terraform apply' without reviewing the plan first!"

