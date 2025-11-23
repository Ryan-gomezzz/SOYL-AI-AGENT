# SES Domain Verification - DNS Setup Guide

This guide will help you add the required DNS TXT record to verify your domain with AWS SES.

## DNS Record Details

**Domain:** www.soyl.cloud

**Record to Add:**
- **Type:** TXT
- **Name/Host:** `_amazonses.www.soyl.cloud` (or `_amazonses.www` depending on your DNS provider)
- **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
- **TTL:** 3600 (or default)

## Step-by-Step Instructions

### Option 1: If Your DNS Provider is AWS Route 53

1. Go to AWS Console → Route 53 → Hosted Zones
2. Select your domain: `soyl.cloud` or `www.soyl.cloud`
3. Click **Create Record**
4. Configure:
   - **Record name:** `_amazonses.www` (or `_amazonses.www.soyl.cloud` if subdomain hosted zone)
   - **Record type:** `TXT - Text`
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** 3600 (or default)
5. Click **Create Records**

### Option 2: If Your DNS Provider is Cloudflare

1. Log in to Cloudflare Dashboard
2. Select your domain: `soyl.cloud`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type:** `TXT`
   - **Name:** `_amazonses.www` (this will create `_amazonses.www.soyl.cloud`)
   - **Content:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** Auto (or 3600)
6. Click **Save**

### Option 3: If Your DNS Provider is GoDaddy

1. Log in to GoDaddy Domain Manager
2. Select your domain: `soyl.cloud`
3. Click **DNS** or **Manage DNS**
4. Scroll to **Records** section
5. Click **Add** (in the TXT records section)
6. Configure:
   - **Type:** `TXT`
   - **Host:** `_amazonses.www` (or `_amazonses.www.soyl.cloud`)
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** 1 Hour (or default)
7. Click **Save**

### Option 4: If Your DNS Provider is Namecheap

1. Log in to Namecheap
2. Go to **Domain List** → Select `soyl.cloud`
3. Click **Manage** → Go to **Advanced DNS** tab
4. In **Host Records** section, click **Add New Record**
5. Configure:
   - **Type:** `TXT Record`
   - **Host:** `_amazonses.www` (or `_amazonses.www.soyl.cloud`)
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** Automatic (or 3600)
6. Click **Save All Changes**

### Option 5: Generic DNS Provider Instructions

1. Log in to your DNS provider's control panel
2. Navigate to DNS Management / DNS Settings
3. Find the section for TXT records
4. Add a new TXT record with:
   - **Host/Name:** `_amazonses.www` (or `_amazonses.www.soyl.cloud`)
   - **Value:** `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`
   - **TTL:** 3600 seconds (1 hour) or default
5. Save the record

## Important Notes

1. **Full FQDN:** Some DNS providers automatically append your domain name. For example:
   - If you enter `_amazonses.www`, it becomes `_amazonses.www.soyl.cloud`
   - If you enter `_amazonses.www.soyl.cloud`, it becomes `_amazonses.www.soyl.cloud.soyl.cloud` (wrong!)
   
   **Check your provider's documentation to see if they auto-append the domain.**

2. **DNS Propagation:** After adding the record, it may take 5 minutes to 48 hours for DNS changes to propagate worldwide. Usually, it takes 15-30 minutes.

3. **Verification:** AWS SES will automatically check for the DNS record. You can verify the status by:
   - Running: `terraform output ses_domain_identity_verification_token`
   - Or checking AWS SES Console → Verified identities

## Verify DNS Record is Working

After adding the DNS record, you can verify it's correctly configured using these commands:

### Windows PowerShell:
```powershell
nslookup -type=TXT _amazonses.www.soyl.cloud
```

### Linux/Mac:
```bash
dig TXT _amazonses.www.soyl.cloud
```

You should see the value: `sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=`

## After DNS is Configured

Once the DNS record has propagated (usually 15-30 minutes), you need to uncomment the SES verification resource in Terraform:

1. Edit `infra/terraform/ses.tf`
2. Uncomment the `aws_ses_domain_identity_verification.main` resource
3. Run `terraform apply` to verify the domain

Alternatively, AWS SES will automatically detect the DNS record and verify the domain without needing Terraform to do it.

## Troubleshooting

- **Record not found:** Wait longer for DNS propagation (up to 48 hours)
- **Wrong value:** Double-check the TXT record value matches exactly (including the `=` at the end)
- **Verification still pending:** Ensure the record name is exactly `_amazonses.www.soyl.cloud` (full FQDN)

## Quick Reference

```
Record Type: TXT
Name: _amazonses.www.soyl.cloud
Value: sHTdUTtCFAzK5xu9B+gxdlxE7EyLMjGPHkoD6PeuFiU=
TTL: 3600
```

