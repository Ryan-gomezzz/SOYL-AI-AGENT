# DRY-RUN REPORT: Canonical Reference Files Addition

## ✅ Completion Status

All tasks completed successfully. Branch created, files committed, and pushed to remote.

## 📁 Created Files

### Reference Files
1. **reference/README.md** (179 lines)
   - Canonical source of truth for the project
   - 8-week plan breakdown
   - Architecture, data model, API contracts
   - Hallucination & verification rules
   - CI/PR rules for LLM-generated content

2. **reference/prompt-templates.md** (57 lines)
   - intent_extraction_v1 (v1.0)
   - post_call_summary_v1 (v1.0)
   - followup_email_v1 (v1.0)

3. **reference/json-schemas/intent-extraction.schema.json** (27 lines)
   - Valid JSON schema for intent extraction
   - Validated: ✅ JSON schema is valid

4. **reference/diagrams/placeholder.txt** (3 lines)
   - Placeholder for future flow diagrams

### CI/CD Files
5. **.github/workflows/reference-check.yml** (28 lines)
   - GitHub Actions workflow
   - Checks for Reference-Sections in PR body
   - Blocks edits to /reference/* without MAINTAINER label

### Updated Scripts
6. **scripts/run-local.sh** (simplified)
   - Brings up local dev stack: Postgres, Redis, backend

7. **scripts/terraform-dry-run.sh** (simplified)
   - Terraform init, validate, plan
   - Saves plan to week1_plan.txt

## 📊 File Summary

| File Path | Lines | Status |
|-----------|-------|--------|
| reference/README.md | 179 | ✅ Created |
| reference/prompt-templates.md | 57 | ✅ Created |
| reference/json-schemas/intent-extraction.schema.json | 27 | ✅ Created & Validated |
| reference/diagrams/placeholder.txt | 3 | ✅ Created |
| .github/workflows/reference-check.yml | 28 | ✅ Created |
| scripts/run-local.sh | 3 | ✅ Updated |
| scripts/terraform-dry-run.sh | 5 | ✅ Updated |

**Total**: 7 files created/updated

## 🔍 First 10 Lines of Each File

### reference/README.md
```
# Project Reference — AI CA Agent (Canonical Source of Truth)

## Purpose

This file is the canonical reference for all humans and automation (Cursor, CI AIs, build scripts).

Every automated agent (Cursor or other LLM) MUST read and obey this file before producing infra, code, or prompts. If anything in generated output conflicts with this file, that output must be considered incorrect.

## Quick facts (project meta)
```

### reference/prompt-templates.md
```
# Prompt templates (versioned) - do not edit without MAINTAINER approval

## intent_extraction_v1 (v1.0)

```
SYSTEM:
You are an extraction engine. Use ONLY the EVIDENCE blocks provided. Respond in JSON matching the schema at /reference/json-schemas/intent-extraction.schema.json. If evidence is missing, set fields to null and include "note":"INSUFFICIENT_DATA".
```

### reference/json-schemas/intent-extraction.schema.json
```
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "service_needed": {
      "type": "string",
      "enum": ["GST", "Startup_Registration", "Income_Tax_Individual", "Income_Tax_Business", "Other"]
    },
```

## 🌿 Git Information

- **Branch**: `infra/add-reference`
- **Commit**: `3e8061a` - "chore(reference): add canonical reference files + prompt templates + ci check"
- **Status**: ✅ Pushed to remote
- **Remote URL**: https://github.com/Ryan-gomezzz/SOYL-AI-AGENT
- **PR URL**: https://github.com/Ryan-gomezzz/SOYL-AI-AGENT/pull/new/infra/add-reference

## 📋 Next Steps (Manual Actions Required)

### 1. Create Pull Request

**Title**: `chore(reference): add canonical reference artifacts (reference/README.md, prompt templates, schemas, reference-check workflow)`

**Body**: Use contents from `docs/PR_REFERENCE_ADD.md`

**PR Type**: Draft PR

**Base**: `main`
**Head**: `infra/add-reference`

### 2. TODO List with Owners

- [ ] **Fill contact details in reference/README.md** (Owner: Engineer leads)
  - Engineer A (Infra lead): <fill>
  - Engineer B (LLM lead): <fill>
  - Engineer C (Frontend lead): <fill>

- [ ] **Add final SVG diagrams to /reference/diagrams/** (Owner: Engineer C)
  - flow_week1.png
  - flow_week2.png
  - etc.

- [ ] **Run scripts/terraform-dry-run.sh locally and attach week1_plan.txt** (Owner: Engineer A)
  - Ensure Terraform is installed
  - Run script and verify output
  - Attach plan file to PR if needed

- [ ] **Verify scripts/run-local.sh works locally** (Owner: Engineer C)
  - Test Docker Compose setup
  - Verify backend starts correctly

- [ ] **Validate JSON schema with jq** (Owner: Engineer B)
  ```bash
  jq . reference/json-schemas/intent-extraction.schema.json
  ```

## ✅ Validation Results

- ✅ JSON schema validation: PASSED
- ✅ Git branch created: PASSED
- ✅ Files committed: PASSED
- ✅ Branch pushed to remote: PASSED
- ✅ No infrastructure changes: CONFIRMED
- ✅ No AWS CLI create commands: CONFIRMED
- ✅ No secrets in commits: CONFIRMED

## 🔒 Safety Checks

- ✅ No `terraform apply` commands executed
- ✅ No AWS CLI create commands executed
- ✅ No destructive changes
- ✅ All files are reference/documentation only
- ✅ Scripts are executable (will be set on Unix systems)

## 📝 PR Description Template

The PR description has been prepared in `docs/PR_REFERENCE_ADD.md` and includes:

- Summary of files added
- Reference-Sections mapping
- Checklist for reviewers
- Notes about canonical reference structure

## 🎯 Acceptance Criteria Status

- ✅ Branch `infra/add-reference` exists with all files listed
- ✅ All reference files created with exact contents
- ✅ JSON schema validated
- ✅ CI workflow created
- ✅ Scripts updated
- ⏳ Draft PR ready to be created (manual step)
- ✅ No infra apply or AWS CLI create commands executed
- ✅ Clear DRY-RUN REPORT provided

## 📞 Instructions for Creating PR

1. Visit: https://github.com/Ryan-gomezzz/SOYL-AI-AGENT/pull/new/infra/add-reference
2. Set title: `chore(reference): add canonical reference artifacts (reference/README.md, prompt templates, schemas, reference-check workflow)`
3. Copy contents from `docs/PR_REFERENCE_ADD.md` as PR body
4. Mark as **Draft PR**
5. Set base: `main`, head: `infra/add-reference`
6. Submit PR

---

**Generated by Cursor (dry-run). Human approval required for merging.**

**Status**: ✅ All files created, committed, and pushed. Ready for PR creation.

