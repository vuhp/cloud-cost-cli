# cloud-cost-cli

[![npm version](https://img.shields.io/npm/v/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A command-line tool that analyzes your AWS, Azure, and GCP resources to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

**✨ NEW in v0.6.2:** HTML export — Beautiful, interactive reports that auto-open in your browser!  
**✨ NEW in v0.6.0:** 11 additional analyzers — Lambda, DynamoDB, ElastiCache, CosmosDB, and more!  

---

## Quick Start

```bash
# Install
npm install -g cloud-cost-cli

# Scan AWS
cloud-cost-cli scan --provider aws --region us-east-1

# Generate HTML report
cloud-cost-cli scan --provider aws --output html
```

---

## Features

- ✅ **Multi-cloud support** - AWS, Azure, and GCP
- ✅ **26 analyzers** - EC2, RDS, Lambda, DynamoDB, ElastiCache, CosmosDB, and more
- ✅ **Export formats** - HTML (interactive charts), Excel, CSV, JSON, or terminal table
- ✅ **AI-powered explanations** - Get recommendations with OpenAI or local Ollama
- ✅ **Natural language queries** - Ask "What's my biggest cost?" or "Show me idle VMs"
- ✅ **Graceful error handling** - Missing permissions? Tool continues with available analyzers
- ✅ **Privacy-first** - Use local Ollama for 100% private AI analysis

---

## What It Finds

### AWS (13 analyzers)
- EC2 instances (idle, stopped, low CPU)
- EBS volumes (unattached, snapshots)
- RDS instances (oversized, low CPU)
- S3 buckets (lifecycle policies)
- Lambda functions (unused, over-provisioned memory)
- DynamoDB tables (on-demand opportunities)
- NAT Gateways (unused)
- ElastiCache (oversized clusters)
- ECS/Fargate (inactive services)
- CloudWatch Logs (retention policies)
- ELB (unused load balancers)
- Elastic IPs (unattached)
- Snapshots (old, stale)

### Azure (8 analyzers)
- Virtual Machines (idle, stopped)
- Managed Disks (unattached)
- Storage Accounts (lifecycle policies)
- SQL Databases (oversized)
- App Service Plans (empty, oversized)
- Azure Functions (over-provisioned)
- CosmosDB (over-provisioned throughput)
- Public IPs (unattached)

### GCP (5 analyzers)
- Compute Engine (idle, stopped)
- Cloud Storage (lifecycle policies)
- Cloud SQL (oversized)
- Persistent Disks (unattached)
- Static IPs (unattached)

---

## Installation

**Requirements:**
- Node.js >= 18
- Cloud credentials (AWS CLI, Azure CLI, or gcloud CLI)

```bash
npm install -g cloud-cost-cli
```

**Cloud authentication:**
```bash
# AWS
aws configure

# Azure
az login
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

# GCP
gcloud auth application-default login
export GCP_PROJECT_ID="your-project-id"
```

---

## Usage

### Basic Scans

```bash
# AWS
cloud-cost-cli scan --provider aws --region us-east-1

# Azure
cloud-cost-cli scan --provider azure --location eastus

# GCP  
cloud-cost-cli scan --provider gcp --region us-central1
```

### Export Formats

```bash
# HTML - Interactive report with charts (opens in browser)
cloud-cost-cli scan --provider aws --output html

# Excel - Professional report with summary sheets
cloud-cost-cli scan --provider aws --output excel

# CSV - Import to spreadsheets
cloud-cost-cli scan --provider aws --output csv

# JSON - API integration
cloud-cost-cli scan --provider aws --output json > report.json
```

### HTML Export (NEW in v0.6.2)

Beautiful, self-contained HTML reports perfect for sharing:

```bash
cloud-cost-cli scan --provider aws --output html
```

**Features:**
- 📊 Interactive charts (pie chart by service, bar chart for top 10)
- 🔍 Sortable and searchable opportunity table
- 📱 Responsive design (mobile-friendly)
- 📧 Email as attachment (no CLI needed for recipients!)
- 🖨️ Print to PDF for presentations
- 🌐 Host on GitHub Pages or S3
- 💾 Self-contained (~24KB, works offline)

### AI-Powered Analysis

Get human-readable explanations for why resources are costing money:

```bash
# Using OpenAI (fast, requires API key)
export OPENAI_API_KEY="sk-..."
cloud-cost-cli scan --provider aws --explain

# Using Ollama (free, private, runs locally)
cloud-cost-cli scan --provider aws --explain --ai-provider ollama

# Ask natural language questions
cloud-cost-cli ask "What's my biggest cost opportunity?"
cloud-cost-cli ask "Show me all idle EC2 instances"
```

**Setup Ollama (optional):**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (one-time, ~4GB)
ollama pull llama3.1:8b

# Configure
cloud-cost-cli config set ai.provider ollama
cloud-cost-cli config set ai.model "llama3.1:8b"
```

### Advanced Options

```bash
# Show more opportunities
cloud-cost-cli scan --provider aws --top 20

# Filter by minimum savings
cloud-cost-cli scan --provider azure --min-savings 50

# Configuration file
cloud-cost-cli config init        # Create config
cloud-cost-cli config show        # View config
cloud-cost-cli config set ai.provider ollama
```

---

## Example Output

```
Cloud Cost Optimization Report
Provider: AWS | Region: us-east-1
Analyzed: 2026-01-01 to 2026-01-31

Top 5 Savings Opportunities (est. $1,245/month):

┌───┬──────────┬────────────────────┬──────────────────────────────────────────┬─────────────┐
│ # │ Type     │ Resource ID        │ Recommendation                           │ Savings/mo  │
├───┼──────────┼────────────────────┼──────────────────────────────────────────┼─────────────┤
│ 1 │ EC2      │ i-0abc123def456    │ Stop idle instance (CPU: 2%)             │ $65.00      │
│ 2 │ EBS      │ vol-0xyz789abc     │ Delete unattached volume (500 GB)        │ $40.00      │
│ 3 │ RDS      │ mydb-production    │ Downsize to db.t3.large (CPU: 15%)       │ $180.00     │
│ 4 │ Lambda   │ api-handler-legacy │ Delete unused function (62 days)         │ $18.50      │
│ 5 │ DynamoDB │ session-cache      │ Switch to On-Demand pricing              │ $22.40      │
└───┴──────────┴────────────────────┴──────────────────────────────────────────┴─────────────┘

Total potential savings: $1,245/month ($14,940/year)
```

**With HTML export:**
- Summary cards: Total savings, # opportunities, average per resource
- Pie chart: Savings by service
- Bar chart: Top 10 opportunities
- Full searchable table

---

## Real Examples (v0.6.0 analyzers)

```
💰 Azure App Service Plan: ASP-production-premium
   Status: Empty (0 apps deployed)
   Cost: $292/month → Save $292/month

💰 CosmosDB: customer-db  
   Provisioned: 10,000 RU/s | Actual usage: ~500 RU/s
   Recommendation: Reduce to 1,000 RU/s → Save $520/month

💰 AWS NAT Gateway: nat-0abc123xyz
   Data processed: 0.15 GB (30 days)
   Recommendation: Delete → Save $32.85/month

💰 ElastiCache: dev-redis (cache.r5.large)
   CPU: 3% | Connections: 2 avg
   Recommendation: Downsize to t3.medium → Save $85/month
```

**Total from these 4 examples: $929.85/month = $11,158/year** 💰

---

## Configuration File

**Location:** `~/.cloud-cost-cli.json`

```json
{
  "ai": {
    "provider": "ollama",
    "model": "llama3.1:8b",
    "maxExplanations": 5
  },
  "scan": {
    "defaultProvider": "aws",
    "defaultRegion": "us-east-1",
    "minSavings": 10
  }
}
```

---

## FAQ

**Q: Does this tool make changes to my infrastructure?**  
A: No. Read-only access only. It never modifies or deletes resources.

**Q: What permissions are required?**  
A: Read-only permissions:
- **AWS**: ReadOnlyAccess policy (or see [IAM_PERMISSIONS.md](IAM_PERMISSIONS.md) for minimal policy)
- **Azure**: Reader role on subscription
- **GCP**: Compute Viewer, Storage Viewer, Cloud SQL Viewer roles

If permissions are missing, the tool skips those analyzers and continues.

**Q: How accurate are the savings estimates?**  
A: Based on standard pay-as-you-go pricing (January 2026) for us-east-1 / East US / us-central1. Actual costs vary by region and discounts (Reserved Instances, Savings Plans). Usage patterns analyzed over 7-30 days. Estimates are directional — even ±20% accuracy identifies significant savings.

**Q: Is my data sent to OpenAI?**  
A: Only if you use `--explain` with OpenAI (default AI provider). Use `--ai-provider ollama` for 100% local, private analysis.

**Q: How much do AI features cost?**  
A: 
- **Ollama**: Free (runs locally)
- **OpenAI**: ~$0.001-0.01 per scan (very cheap)
- Use `cloud-cost-cli costs` to track OpenAI spending

**Q: Can I run this in CI/CD?**  
A: Yes. Use `--output json` and parse results to fail builds if savings exceed a threshold.

---

## Contributing

Contributions welcome! Please open an issue before submitting large PRs.

```bash
git clone https://github.com/vuhp/cloud-cost-cli.git
cd cloud-cost-cli
npm install
npm run build
npm test
```

---

## License

MIT License - see [LICENSE](LICENSE)

---

**Star this repo if it saves you money!** ⭐
