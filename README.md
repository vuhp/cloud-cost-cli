# cloud-cost-cli

[![npm version](https://img.shields.io/npm/v/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A powerful CLI and web dashboard for analyzing AWS, Azure, and GCP resources to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

**✨ v0.8.0:** Web Dashboard — Interactive UI with secure credential storage and real-time scans!  
**✨ v0.8.0:** Multi-region scanning for all clouds — Scan AWS, Azure, and GCP regions at once!  
**✨ v0.7.0:** Multi-metric analysis — Comprehensive resource utilization (CPU, memory, network, disk) with confidence scoring!

---

## Features

- **🖥️ Web Dashboard** — Interactive UI with credential management, real-time scans, and trend charts
- **Multi-metric analysis** — CPU + memory + network + disk for high-confidence recommendations (AWS, Azure, GCP)
- **Multi-cloud support** - AWS (17 analyzers), Azure (10 analyzers), GCP (8 analyzers)
- **Multi-region scanning** — Find resources in all regions at once (AWS, Azure, GCP)
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

## Quick Start

### Web Dashboard (Recommended)

Launch the interactive web dashboard with credential management and real-time scans:

```bash
cloud-cost-cli dashboard
```

Features:
- 🔐 **Secure credential storage** - Encrypted locally with AES-256-GCM
- 🌍 **Multi-region scanning** - Select specific regions or scan all at once
- 📊 **Real-time updates** - WebSocket-powered progress tracking
- 📈 **Trend charts** - Visualize savings over time
- 🎯 **Detailed opportunities** - Each with account, region, and confidence level
- 💾 **Scan history** - Track all scans with filterable results

The dashboard runs at `http://localhost:9090` and automatically opens in your browser.

### Command Line

For automation and CI/CD, use the CLI directly:

```bash
# Scan AWS (specific region)
cloud-cost-cli scan --provider aws --region us-east-1

# Scan all AWS regions
cloud-cost-cli scan --provider aws --all-regions

# Scan Azure
cloud-cost-cli scan --provider azure --location eastus

# Scan GCP
cloud-cost-cli scan --provider gcp --region us-central1
```

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

### Web Dashboard

Launch the interactive dashboard:

```bash
cloud-cost-cli dashboard
```

**Dashboard Features:**

1. **Credential Management** (Settings page)
   - Add AWS, Azure, or GCP credentials
   - Encrypted locally with AES-256-GCM
   - Support for multiple accounts per provider

2. **Run Scans** (Dashboard page)
   - Select cloud provider (AWS, Azure, GCP)
   - Choose account (if multiple configured)
   - Pick specific region or "All Regions"
   - Toggle detailed metrics for high-confidence analysis

3. **View Results**
   - Real-time progress via WebSocket
   - Total savings and annual projections
   - Trend charts (30-day history)
   - Recent scans list

4. **Scan Details**
   - Filter by confidence level (High/Medium/Low)
   - Search opportunities by resource ID or type
   - Each opportunity shows:
     - Account ID / Project ID / Subscription ID
     - Region (with badge in multi-region scans)
     - Resource type and ID
     - Confidence level
     - Estimated monthly savings
     - Actionable recommendation

### CLI Usage

#### Multi-Metric Analysis (High Confidence)
```bash
# Default: Fast scan with CPU-only analysis
cloud-cost-cli scan --provider aws --region us-east-1

# Detailed: Multi-metric analysis (CPU + memory + network + disk)
cloud-cost-cli scan --provider aws --region us-east-1 --detailed-metrics
cloud-cost-cli scan --provider azure --location eastus --detailed-metrics
cloud-cost-cli scan --provider gcp --region us-central1 --detailed-metrics
```

**Confidence levels:**
- 🟢 **HIGH** — All metrics low, safe to downsize immediately
- 🟡 **MEDIUM** — Multiple metrics low, review recommended
- 🔴 **LOW** — CPU-only or mixed signals, manual verification needed

**Example output:**
```
# | Type | Resource ID  | Recommendation                           | Confidence | Savings/mo
1 | EC2  | i-abc123     | Low utilization (CPU: 8% | Memory: 15% | HIGH       | $85.00
  |      |              | Network: 0.5 MB/s | Disk: 20 IOPS)   |            |
```

**When to use `--detailed-metrics`:**
- Production environments (higher confidence needed)
- Before making right-sizing decisions
- When accuracy matters more than speed

**Performance:** Adds ~15-30 seconds per 100 resources (negligible API cost)

### Multi-Region Scanning
```bash
# Scan all AWS regions
cloud-cost-cli scan --provider aws --all-regions

# Scan all Azure locations
cloud-cost-cli scan --provider azure --all-regions

# Scan all GCP regions
cloud-cost-cli scan --provider gcp --all-regions

# With detailed metrics
cloud-cost-cli scan --provider aws --all-regions --detailed-metrics
```

**Output:** Resources are tagged with `[region]` prefix for easy identification.

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
💰 EC2 instance: i-0abc123def456
   CPU: 8% | Memory: 15% | Network: 0.5 MB/s | Disk: 20 IOPS
   Recommendation: Low utilization - consider downsizing to t3.medium
   Confidence: HIGH (all metrics low)
   Savings: $85/month

💰 Lambda function: api-handler-legacy
   Last invocation: 62 days ago
   Recommendation: Delete unused function
   Confidence: HIGH
   Savings: $18.50/month

💰 Azure VM: production-api-server
   CPU: 12% | Memory: 25% | Network: 1.2 MB/s | Disk: 45 IOPS
   Recommendation: Low utilization - consider downsizing
   Confidence: HIGH (all metrics low)
   Savings: $120/month

💰 CosmosDB account: customer-db
   Provisioned: 10,000 RU/s | Usage: ~500 RU/s
   Recommendation: Reduce to 1,000 RU/s
   Confidence: HIGH
   Savings: $520/month

Total: $743.50/month = $8,922/year
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

**What's the difference between default and --detailed-metrics mode?**  
- **Default:** Fast scan using CPU utilization only (LOW confidence)
- **--detailed-metrics:** Comprehensive analysis using CPU + memory + network + disk (HIGH confidence when all metrics are low)
- Use detailed mode before making production changes

**Does --detailed-metrics require CloudWatch/monitoring agents?**  
- **AWS:** CloudWatch agent needed for memory metrics (CPU/network/disk work without it)
- **Azure:** Memory available by default (no agent needed)
- **GCP:** Monitoring agent needed for memory metrics (CPU/network/disk work without it)
- Tool gracefully degrades if data unavailable

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
