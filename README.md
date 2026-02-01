# cloud-cost-cli

[![npm version](https://badge.fury.io/js/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A command-line tool that analyzes your AWS, Azure, and GCP resources to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

**✨ NEW in v0.4.0:** GCP support (Compute Engine + Cloud Storage)!  
**✨ v0.3.0:** AI-powered explanations and natural language queries!

---

## The Problem

Cloud bills are growing faster than revenue. Engineering teams overprovision, forget to clean up dev resources, and lack visibility into what's actually costing money. Existing cost management tools are expensive, slow, or buried in complex dashboards.

## The Solution

`cloud-cost-cli` connects to your cloud accounts, analyzes resource usage and billing data, and outputs a ranked list of actionable savings opportunities — all in your terminal, in under 60 seconds.

**What it finds:**
- Idle VMs/Compute instances (low CPU, stopped but still billed)
- Unattached volumes, disks, and snapshots
- Oversized database instances (RDS, Azure SQL)
- Old load balancers with no traffic
- Unused public IP addresses
- Underutilized resources that can be downsized
- Storage without lifecycle policies

---

## Features

**Current capabilities:**
- ✅ **Multi-cloud support** - AWS, Azure, and GCP
- ✅ **AWS analyzers** - EC2, EBS, RDS, S3, ELB, Elastic IP
- ✅ **Azure analyzers** - VMs, Managed Disks, Storage, SQL, Public IPs
- ✅ **GCP analyzers** - Compute Engine, Cloud Storage, Cloud SQL, Persistent Disks, Static IPs
- ✅ **🤖 AI-powered explanations** - Get human-readable explanations for why resources are costing money
- ✅ **💬 Natural language queries** - Ask questions like "What's my biggest cost?" or "Show me idle VMs"
- ✅ **🔒 Privacy-first AI** - Use local Ollama or cloud OpenAI
- ✅ **💰 Cost tracking** - Track AI API costs (OpenAI only)
- ✅ **⚙️ Configuration file** - Save your preferences
- ✅ Connect via cloud credentials (read-only recommended)
- ✅ Analyze last 7-30 days of usage
- ✅ Output top savings opportunities with estimated monthly savings
- ✅ Export report as JSON or terminal table
- ✅ Filter by minimum savings amount

**Potential future additions:**
- More GCP services (Cloud Functions, Load Balancers, etc.)
- Real-time pricing API integration
- Additional AWS services (Lambda, DynamoDB, CloudFront, etc.)
- Additional Azure services (App Services, CosmosDB, etc.)
- Multi-region analysis
- Historical cost tracking
- Scheduled scans and notifications
- CI/CD integration examples
- Custom analyzer rules

No commitment on timeline - contributions welcome!

---

## Installation

**Requirements:**
- Node.js >= 18
- Cloud credentials (choose one per provider):
  - **AWS**: 
    - [AWS CLI configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) OR
    - Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
  - **Azure**:
    - [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) (`az login`) OR
    - Service Principal (env vars: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`) OR
    - Managed Identity (for Azure VMs)
  - **GCP**:
    - [gcloud CLI](https://cloud.google.com/sdk/docs/install) (`gcloud auth application-default login`) OR
    - Service Account JSON key (env var: `GOOGLE_APPLICATION_CREDENTIALS`) OR
    - Compute Engine default credentials (for GCP VMs)
- **Optional for AI features**:
  - OpenAI API key OR
  - [Ollama](https://ollama.ai) installed locally (free, private, runs on your machine)

**Install via npm:**
```bash
npm install -g cloud-cost-cli
```

---

## Usage

### Basic Scan

**AWS scan:**
```bash
cloud-cost-cli scan --provider aws --profile default --region us-east-1
```

**Azure scan:**
```bash
# Option 1: Azure CLI (easiest for local use)
az login
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
cloud-cost-cli scan --provider azure --location eastus

# Option 2: Service Principal (recommended for CI/CD and automation)
export AZURE_CLIENT_ID="your-app-id"
export AZURE_CLIENT_SECRET="your-secret"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
cloud-cost-cli scan --provider azure --location eastus
```

**GCP scan:**
```bash
# Option 1: gcloud CLI (easiest for local use)
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
export GCP_PROJECT_ID="your-project-id"
cloud-cost-cli scan --provider gcp --region us-central1

# Option 2: Service Account (recommended for CI/CD and automation)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/keyfile.json"
export GCP_PROJECT_ID="your-project-id"
cloud-cost-cli scan --provider gcp --region us-central1

# Option 3: CLI flag
cloud-cost-cli scan --provider gcp --project-id your-project-id --region us-central1
```

**How to create Azure Service Principal:**
```bash
# Create service principal with Reader role
az ad sp create-for-rbac --name "cloud-cost-cli" --role Reader --scopes /subscriptions/YOUR_SUBSCRIPTION_ID

# Output will show:
# {
#   "appId": "xxx",          # Use as AZURE_CLIENT_ID
#   "password": "xxx",       # Use as AZURE_CLIENT_SECRET
#   "tenant": "xxx"          # Use as AZURE_TENANT_ID
# }
```

### 🤖 AI-Powered Features

**Get AI explanations for opportunities:**
```bash
# Using OpenAI (requires API key)
export OPENAI_API_KEY="sk-..."
cloud-cost-cli scan --provider aws --region us-east-1 --explain

# Using local Ollama (free, private, no API key needed)
cloud-cost-cli scan --provider aws --region us-east-1 --explain --ai-provider ollama
```

**Ask natural language questions:**
```bash
# First, run a scan to collect data
cloud-cost-cli scan --provider aws --region us-east-1

# Then ask questions about your costs
cloud-cost-cli ask "What's my biggest cost opportunity?"
cloud-cost-cli ask "Show me all idle EC2 instances"
cloud-cost-cli ask "How much can I save on storage?"
cloud-cost-cli ask "Which resources should I optimize first?"
```

**Configure AI settings (saves preferences):**
```bash
# Initialize config file
cloud-cost-cli config init

# Set AI provider (openai or ollama)
cloud-cost-cli config set ai.provider ollama

# Set OpenAI API key (if using OpenAI)
cloud-cost-cli config set ai.apiKey "sk-..."

# Set AI model
cloud-cost-cli config set ai.model "llama3.1:8b"  # For Ollama
cloud-cost-cli config set ai.model "gpt-4o-mini"  # For OpenAI

# Set max explanations (how many to explain)
cloud-cost-cli config set ai.maxExplanations 5

# View your config
cloud-cost-cli config show
```

**Track AI costs (OpenAI only):**
```bash
# View AI API costs
cloud-cost-cli costs

# View last 7 days
cloud-cost-cli costs --days 7

# Clear cost tracking
cloud-cost-cli costs --clear
```

### Advanced Options

**Show more opportunities:**
```bash
cloud-cost-cli scan --provider aws --top 20  # Show top 20 instead of default 5
```

**Filter by minimum savings:**
```bash
cloud-cost-cli scan --provider azure --min-savings 50  # Only show opportunities > $50/month
```

**Specify output format:**
```bash
cloud-cost-cli scan --provider aws --output json > report.json
```

**Example output (with AI explanations):**
```
Cloud Cost Optimization Report
Provider: AWS | Region: us-east-1 | Account: N/A
Analyzed: 2026-01-01 to 2026-01-31

Top 5 Savings Opportunities (est. $1,245/month):

┌───┬──────────┬────────────────────────────────────────┬──────────────────────────────────────────────────────────┬─────────────┐
│ # │ Type     │ Resource ID                            │ Recommendation                                           │ Savings/mo  │
├───┼──────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────────┼─────────────┤
│ 1 │ EC2      │ i-0abc123def456                        │ Stop idle instance (CPU: 2%)                             │ $65.00      │
├───┼──────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────────┼─────────────┤
│ 2 │ EBS      │ vol-0xyz789abc                         │ Delete unattached volume (500 GB)                        │ $40.00      │
├───┼──────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────────┼─────────────┤
│ 3 │ RDS      │ mydb-production                        │ Downsize from db.r5.xlarge to db.t3.large (CPU: 15%)    │ $180.00     │
└───┴──────────┴────────────────────────────────────────┴──────────────────────────────────────────────────────────┴─────────────┘

🤖 AI Explanations:

💡 Opportunity #1: Stop idle instance (CPU: 2%)
   This EC2 instance is consuming only 2% CPU, indicating it's severely underutilized. 
   Consider stopping it during off-hours or right-sizing to a smaller instance type.
   Quick win: Stop it immediately if it's a dev/test server not actively used.
   Risk: Low - monitor for 24h first to confirm usage patterns.

💡 Opportunity #2: Delete unattached volume (500 GB)
   This EBS volume isn't attached to any instance but you're still paying for storage.
   Either delete it if data isn't needed, or create a snapshot first for backup.
   Quick win: Take a snapshot ($0.05/GB/mo vs $0.08/GB/mo), then delete the volume.
   Risk: Medium - verify no one needs this data before deleting.

💡 Opportunity #3: Downsize RDS instance
   Your database is only using 15% CPU on a db.r5.xlarge. You're paying for 4 vCPUs 
   but only need 1-2. Downsize to db.t3.large (2 vCPUs) and save $180/month.
   Quick win: Schedule a downsize during your next maintenance window.
   Risk: Low-Medium - test query performance after resize.

Total potential savings: $1,245/month ($14,940/year)

ℹ AI explanations powered by OpenAI GPT-4o-mini (cost: ~$0.001)
```

---

## AI Features Setup

### Option 1: OpenAI (Cloud, Paid)

**Pros:** Fast, accurate, works anywhere  
**Cons:** Costs ~$0.001-0.01 per scan (very cheap!), data sent to OpenAI

```bash
# Get API key from https://platform.openai.com/api-keys
export OPENAI_API_KEY="sk-..."

# Or save to config
cloud-cost-cli config set ai.apiKey "sk-..."
cloud-cost-cli config set ai.provider openai
```

### Option 2: Ollama (Local, Free)

**Pros:** Free, private (runs on your machine), no API costs  
**Cons:** Requires ~4GB RAM, slower than OpenAI

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model (one-time, ~4GB download)
ollama pull llama3.1:8b

# Configure cloud-cost-cli
cloud-cost-cli config set ai.provider ollama
cloud-cost-cli config set ai.model "llama3.1:8b"

# Use it
cloud-cost-cli scan --provider aws --region us-east-1 --explain
```

**Recommended Ollama models:**
- `llama3.1:8b` - Best balance (4GB RAM, good quality)
- `llama3.2:3b` - Faster, less RAM (2GB, slightly lower quality)
- `mistral:7b` - Alternative, similar to llama3.1

---

## Configuration File

**Location:** `~/.cloud-cost-cli.json`

**Example config:**
```json
{
  "ai": {
    "provider": "ollama",
    "model": "llama3.1:8b",
    "maxExplanations": 5,
    "cache": {
      "enabled": true,
      "ttlDays": 7
    }
  },
  "scan": {
    "defaultProvider": "aws",
    "defaultRegion": "us-east-1",
    "defaultTop": 5,
    "minSavings": 10
  },
  "aws": {
    "profile": "default",
    "region": "us-east-1"
  }
}
```

**Manage config:**
```bash
cloud-cost-cli config init        # Create config file
cloud-cost-cli config show        # View current config
cloud-cost-cli config get ai.provider    # Get specific value
cloud-cost-cli config set ai.provider ollama  # Set value
cloud-cost-cli config path        # Show config file location
```

---

## Pricing Estimates

**How cost estimates work:**

Cost savings are estimated using AWS on-demand pricing for **us-east-1** (January 2026). These are approximations to help you prioritize optimization efforts.

**Important notes:**
- 💵 Actual costs vary by region (e.g., ap-southeast-1 may be 10-15% higher)
- 📊 Estimates don't include Reserved Instances, Savings Plans, or spot discounts
- 🔄 AWS pricing changes periodically
- ⚙️ Additional costs like data transfer and storage operations not included

**For the most accurate estimates:**
- Cross-reference with your AWS Cost Explorer or Azure Cost Management
- Consider estimates as directional guidance, not exact amounts
- Real-time pricing API integration coming in a future release

The goal is to help you find waste quickly — even if estimates are ±20%, you'll still identify significant savings opportunities.

---

## Contributing

Contributions welcome! Please open an issue before submitting large PRs.

**Development setup:**
```bash
git clone https://github.com/vuhp/cloud-cost-cli.git
cd cloud-cost-cli
npm install
npm run build
```

**Run tests:**
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage report
npm run test:ui       # Interactive UI
```

**Development workflow:**
```bash
npm run dev -- scan --provider aws --profile your-profile  # Test locally
npm run build                                              # Compile TypeScript
```

---

## Support This Project

If cloud-cost-cli helps you save money, consider [sponsoring on GitHub](https://github.com/sponsors/vuhp).

Your support helps fund:
- 🚀 New cloud provider integrations
- 🐛 Bug fixes and maintenance
- 📚 Better documentation
- ✨ Community feature requests

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Credits

**Built with:**
- [AWS SDK for JavaScript v3](https://aws.amazon.com/sdk-for-javascript/) - AWS cloud APIs
- [Azure SDK for JavaScript](https://azure.github.io/azure-sdk-for-js/) - Azure cloud APIs
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [cli-table3](https://github.com/cli-table/cli-table3) - Terminal tables
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [OpenAI API](https://platform.openai.com/) - AI explanations
- [Ollama](https://ollama.ai) - Local AI models

---

## FAQ

**Q: Does this tool make changes to my infrastructure?**  
A: No. It only reads resource metadata and usage metrics. It never modifies or deletes resources.

**Q: What permissions are required?**  
A: Read-only permissions for each cloud provider:
- **AWS**: EC2, EBS, RDS, S3, ELB, CloudWatch (see [AWS permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html))
- **Azure**: Reader role on subscription or resource groups

**Q: How accurate are the savings estimates?**  
A: Estimates are based on current pricing and usage patterns. Actual savings may vary by region and your specific pricing agreements (Reserved Instances, Savings Plans, etc.).

**Q: Is my data sent to OpenAI?**  
A: Only if you use OpenAI for AI features. When you use `--explain` without specifying `--ai-provider`, it defaults to OpenAI and requires an API key. Resource metadata and recommendations are sent to OpenAI's API to generate explanations. If you want complete privacy, use `--ai-provider ollama` (or set it in config) which runs 100% locally on your machine.

**Q: How much do AI features cost?**  
A: 
- **Ollama**: Free! Runs locally, no API costs
- **OpenAI**: Very cheap - typically less than $0.001 per scan with GPT-4o-mini (a few operations). Even with hundreds of resources, costs stay under $0.01 per scan. Use `cloud-cost-cli costs` to track your actual spending.

**Q: Can I run this in CI/CD?**  
A: Yes. Use `--output json` and parse the results to fail builds if savings exceed a threshold.

**Q: Do I need AI features to use the tool?**  
A: No! AI features are completely optional. The core cost scanning works without any AI setup.

---

**Star this repo if it saves you money!** ⭐
