# cloud-cost-cli

[![npm version](https://badge.fury.io/js/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A command-line tool that analyzes your AWS, GCP, and Azure bills to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

---

## The Problem

Cloud bills are growing faster than revenue. Engineering teams overprovision, forget to clean up dev resources, and lack visibility into what's actually costing money. Existing cost management tools are expensive, slow, or buried in complex dashboards.

## The Solution

`cloud-cost-cli` connects to your cloud accounts, analyzes resource usage and billing data, and outputs a ranked list of actionable savings opportunities — all in your terminal, in under 60 seconds.

**What it finds:**
- Idle EC2/Compute instances (low CPU, stopped but still billed)
- Unattached EBS volumes and snapshots
- Oversized RDS/database instances
- Old load balancers with no traffic
- Unused Elastic IPs
- Underutilized reserved instances or savings plan mismatches
- Redundant S3 storage (lifecycle policies missing)

---

## Features (MVP - Week 1–2)

- ✅ AWS support (EC2, EBS, RDS, S3, ELB, Elastic IP)
- ✅ Connect via AWS credentials (IAM read-only recommended)
- ✅ Analyze last 30 days of usage
- ✅ Output top 5 savings opportunities with estimated monthly savings
- ✅ Export report as JSON, Markdown, or terminal table
- ✅ Zero third-party API dependencies (uses AWS SDK directly)

**Coming soon:**
- GCP and Azure support
- Slack/email alerts for new cost spikes
- Scheduled reports (cron-friendly)
- Team dashboard (web UI, SaaS)
- Custom rules and thresholds
- Terraform/IaC integration (flag risky configs before apply)

---

## Installation

**Requirements:**
- Node.js >= 18 (or use the standalone binary)
- AWS credentials configured (see [AWS CLI setup](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html))

**Install via npm:**
```bash
npm install -g cloud-cost-cli
```

**Or download standalone binary:**
```bash
# macOS/Linux
curl -L https://github.com/vuhp/cloud-cost-cli/releases/latest/download/cloud-cost-cli-$(uname -s)-$(uname -m) -o /usr/local/bin/cloud-cost-cli
chmod +x /usr/local/bin/cloud-cost-cli

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/vuhp/cloud-cost-cli/releases/latest/download/cloud-cost-cli-windows-x64.exe" -OutFile "$env:USERPROFILE\bin\cloud-cost-cli.exe"
```

---

## Usage

**Basic scan (AWS):**
```bash
cloud-cost-cli scan --provider aws --profile default
```

**Specify region and output format:**
```bash
cloud-cost-cli scan --provider aws --region us-east-1 --output json > report.json
```

**Top N opportunities:**
```bash
cloud-cost-cli scan --provider aws --top 10
```

**Example output:**
```
Cloud Cost Optimization Report
Provider: AWS | Region: us-east-1 | Account: 123456789012
Analyzed: 2026-01-01 to 2026-01-31

Top 5 Savings Opportunities (est. $1,245/month):

1. Idle EC2 instance: i-0abc123def456
   Type: m5.large | Running 720h | Avg CPU: 2%
   → Recommendation: Stop or downsize to t3.small
   → Est. savings: $65/month

2. Unattached EBS volume: vol-0xyz789abc
   Size: 500 GB (gp3) | Age: 45 days
   → Recommendation: Delete or snapshot + delete
   → Est. savings: $40/month

3. Oversized RDS instance: mydb-production
   Type: db.r5.xlarge | Avg connections: 5 | Avg CPU: 15%
   → Recommendation: Downsize to db.t3.large
   → Est. savings: $180/month

4. Unused Elastic Load Balancer: my-old-alb
   Active targets: 0 | Requests/day: 0
   → Recommendation: Delete
   → Est. savings: $22/month

5. S3 bucket with no lifecycle policy: logs-bucket-2023
   Size: 12 TB | Age: 18 months
   → Recommendation: Enable Intelligent-Tiering or Glacier transition
   → Est. savings: $938/month

Total potential savings: $1,245/month ($14,940/year)
```

---

## Configuration

Create a config file at `~/.cloud-cost-cli/config.json` (optional):

```json
{
  "aws": {
    "profile": "default",
    "regions": ["us-east-1", "us-west-2"],
    "excludeResources": ["i-0abc123", "vol-xyz"],
    "thresholds": {
      "idleCpuPercent": 5,
      "minAgeDays": 7
    }
  },
  "output": {
    "format": "table",
    "includeRecommendations": true
  }
}
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
- Use the `--accurate` flag (coming in v0.2.0) to fetch real-time pricing
- Cross-reference with your AWS Cost Explorer
- Consider estimates as directional guidance, not exact amounts

The goal is to help you find waste quickly — even if estimates are ±20%, you'll still identify significant savings opportunities.

---

## Roadmap

**Current (v0.1.x):**
- ✅ AWS support (EC2, EBS, RDS, S3, ELB, EIP)
- ✅ CLI with table and JSON output
- ✅ Read-only IAM permissions

**Coming Soon:**
- 🔜 GCP support (Compute Engine, Cloud Storage, Cloud SQL)
- 🔜 Azure support (VMs, Storage, Databases)
- 🔜 More AWS services (Lambda, DynamoDB, CloudFront)
- 🔜 Historical cost tracking
- 🔜 Scheduled scans and notifications

**Future:**
- Multi-cloud support across AWS, GCP, Azure
- CI/CD integration examples
- Web dashboard for teams
- Custom analyzer rules

See [GitHub Issues](https://github.com/vuhp/cloud-cost-cli/issues) for planned features and vote on what you'd like to see next!

---

## Contributing

Contributions welcome! Please open an issue before submitting large PRs.

**Development setup:**
```bash
git clone https://github.com/vuhp/cloud-cost-cli.git
cd cloud-cost-cli
npm install
npm run dev
```

**Run tests:**
```bash
npm test
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

**Powered by:**
- AWS SDK for JavaScript
- Commander.js
- Chalk (terminal colors)
- Table (terminal tables)

---

## FAQ

**Q: Does this tool make changes to my infrastructure?**  
A: No. It only reads billing and usage data. It never modifies or deletes resources.

**Q: What IAM permissions are required?**  
A: Read-only permissions for Cost Explorer, EC2, EBS, RDS, S3, ELB. See [IAM policy template](docs/iam-policy.json).

**Q: How accurate are the savings estimates?**  
A: Estimates are based on current pricing and usage patterns. Actual savings may vary.

**Q: Can I run this in CI/CD?**  
A: Yes. Use `--output json` and fail the build if savings exceed a threshold.

---

**Star this repo if it saves you money!** ⭐
