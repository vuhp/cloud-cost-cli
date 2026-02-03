# cloud-cost-cli

[![npm version](https://img.shields.io/npm/v/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A command-line tool that analyzes your AWS, Azure, and GCP resources to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

**✨ NEW:** Multi-region scanning — Scan all AWS regions at once!  
**✨ NEW:** Comparison mode — Track your cost optimization progress over time!  
**✨ v0.6.2:** HTML export — Beautiful, interactive reports that auto-open in your browser!  
**✨ v0.6.0:** 11 additional analyzers — Lambda, DynamoDB, ElastiCache, CosmosDB, and more!

---

## Features

- **Multi-cloud support** - AWS (13+ analyzers), Azure (8 analyzers), GCP (5 analyzers)
- **Multi-region scanning** — Find resources in all AWS regions at once
- **Comparison mode** — Track optimization progress over time
- **AI-powered explanations** — Human-readable recommendations (OpenAI or local Ollama)
- **Natural language queries** — Ask questions like "What's my biggest cost?"
- **Export formats** — HTML, Excel, CSV, JSON, or terminal table
- **CI/CD integration** — GitHub Action example for automated scanning
- **Privacy-first AI** — Use local Ollama (free) or cloud OpenAI
- **Graceful error handling** — Missing permissions? Tool continues with available analyzers

---

## Installation

**Requirements:**
- Node.js >= 20
- Cloud credentials (AWS CLI, Azure CLI, or gcloud CLI configured)

```bash
npm install -g cloud-cost-cli
```

**Optional:** OpenAI API key or [Ollama](https://ollama.ai) for AI features

---

## Authentication

### AWS

**Option 1: AWS CLI (easiest)**
```bash
aws configure
cloud-cost-cli scan --provider aws --region us-east-1
```

**Option 2: Environment variables**
```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="us-east-1"
cloud-cost-cli scan --provider aws
```

**Option 3: IAM Role (EC2/ECS/Lambda)**
```bash
# No credentials needed - uses instance role
cloud-cost-cli scan --provider aws --region us-east-1
```

### Azure

**Option 1: Azure CLI (easiest for local)**
```bash
az login
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
cloud-cost-cli scan --provider azure --location eastus
```

**Option 2: Service Principal (CI/CD)**
```bash
export AZURE_CLIENT_ID="your-app-id"
export AZURE_CLIENT_SECRET="your-secret"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
cloud-cost-cli scan --provider azure
```

**Create Service Principal:**
```bash
az ad sp create-for-rbac --name "cloud-cost-cli" --role Reader --scopes /subscriptions/YOUR_SUBSCRIPTION_ID
```

### GCP

**Option 1: gcloud CLI (easiest for local)**
```bash
gcloud auth application-default login
export GCP_PROJECT_ID="your-project-id"
cloud-cost-cli scan --provider gcp --region us-central1
```

**Option 2: Service Account (CI/CD)**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export GCP_PROJECT_ID="your-project-id"
cloud-cost-cli scan --provider gcp --region us-central1
```

---

## Quick Start

```bash
# AWS
cloud-cost-cli scan --provider aws --region us-east-1

# Azure
cloud-cost-cli scan --provider azure --location eastus

# GCP
cloud-cost-cli scan --provider gcp --region us-central1

# Multi-region (AWS)
cloud-cost-cli scan --provider aws --all-regions

# Track progress
cloud-cost-cli scan && cloud-cost-cli compare
```

---

## Usage

### AI Explanations
```bash
# OpenAI
export OPENAI_API_KEY="sk-..."
cloud-cost-cli scan --provider aws --explain

# Local Ollama (free, private)
cloud-cost-cli scan --provider aws --explain --ai-provider ollama
```

### Natural Language Queries
```bash
cloud-cost-cli scan --provider aws
cloud-cost-cli ask "What's my biggest cost opportunity?"
```

### Export Formats
```bash
cloud-cost-cli scan --provider aws --output html   # Opens in browser
cloud-cost-cli scan --provider aws --output excel  # For finance team
cloud-cost-cli scan --provider aws --output json   # For CI/CD
```

### Advanced Options
```bash
cloud-cost-cli scan --provider aws --top 20           # Show top 20
cloud-cost-cli scan --provider aws --min-savings 50   # Only > $50/month
```

---

## Example Findings

```bash
💰 Lambda function: api-handler-legacy
   Last invocation: 62 days ago
   Recommendation: Delete unused function
   Savings: $18.50/month

💰 ElastiCache cluster: dev-redis
   CPU: 3%, Connections: 2 avg
   Recommendation: Downsize or delete
   Savings: $85/month

💰 CosmosDB account: customer-db
   Provisioned: 10,000 RU/s | Usage: ~500 RU/s
   Recommendation: Reduce to 1,000 RU/s
   Savings: $520/month

Total: $970/month = $11,640/year
```

---

## CI/CD Integration

```bash
cp examples/github-action/workflow.yml .github/workflows/cloud-cost-scan.yml
```

Features: Weekly scans, PR comments, fail on threshold, artifact uploads.

---

## Configuration

```bash
cloud-cost-cli config init
cloud-cost-cli config set ai.provider ollama
cloud-cost-cli config show
```

---

## FAQ

**Does it modify my infrastructure?**  
No. Read-only access only.

**What permissions are required?**  
AWS: ReadOnlyAccess. Azure: Reader. GCP: Compute/Storage/SQL Viewer.

**How accurate are savings estimates?**  
Based on standard pay-as-you-go pricing. Estimates are directional (±20%) to help prioritize.

**Is my data sent to OpenAI?**  
Only if you use `--explain` with OpenAI. Use `--ai-provider ollama` for 100% local analysis.

**Can I run this in CI/CD?**  
Yes. Use `--output json` or copy the GitHub Action example from `examples/github-action/`.

**How much do AI features cost?**  
Ollama: Free (runs locally). OpenAI: ~$0.001 per scan with gpt-4o-mini model.

---

## License

MIT — see [LICENSE](LICENSE)

**Star this repo if it saves you money!** ⭐
