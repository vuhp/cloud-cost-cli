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

## Roadmap

**Phase 1 (Week 1–2): MVP**
- AWS support (EC2, EBS, RDS, S3, ELB, EIP)
- CLI with basic scan and reporting
- GitHub Sponsors setup
- Launch on Hacker News, Product Hunt, Reddit

**Phase 2 (Month 2):**
- GCP support
- Azure support
- Scheduled reports (cron mode)
- Slack webhook integration
- GitHub Sponsors perks (early access, priority support)

**Phase 3 (Month 3+):**
- SaaS version: connect account, weekly email reports, team dashboard
- Paid tiers: $29/mo (alerts + history), $99/mo (multi-account + API)
- Enterprise: on-prem, SSO, audit logs, custom rules
- Terraform provider (flag cost risks before apply)

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

## Sponsorship

If this tool saves you money, consider sponsoring development via [GitHub Sponsors](https://github.com/sponsors/vuhp).

**Sponsor tiers:**
- ☕ $5/mo: Thank you!
- 🚀 $25/mo: Early access to new features + priority support
- 💼 $100/mo: Logo on README + monthly 1:1 consultation (30 min)
- 🏢 $500/mo: Custom rule development + dedicated Slack channel

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
