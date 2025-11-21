#!/bin/bash
cd infra/terraform
terraform init -input=false
terraform validate
terraform plan -out=week1.plan
terraform show -no-color week1.plan > week1_plan.txt

