# cloud-cost-cli

[![npm version](https://badge.fury.io/js/cloud-cost-cli.svg)](https://www.npmjs.com/package/cloud-cost-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Optimize your cloud spend in seconds.**

A command-line tool that analyzes your AWS and Azure resources to identify cost-saving opportunities — idle resources, oversized instances, unattached volumes, and more.

---

## The Problem

Cloud bills are growing faster than revenue. Engineering teams overprovision, forget to clean up dev resources, and lack visibility into what's actually costing money. Existing cost management tools are expensive, slow, or buried in complex dashboards.

## The Solution

`cloud-cost-cli` connects to your cloud accounts, analyzes resource usage and billing data, and outputs a ranked list of actionable savings opportunities — all in your terminal, in under 60 seconds.

**What it finds:**
- Idle VMs/EC2 instances (low CPU, stopped but still billed)
- Unattached volumes, disks, and snapshots
- Oversized database instances (RDS, Azure SQL)
- Old load balancers with no traffic
- Unused public IP addresses
- Underutilized resources that can be downsized
- Storage without lifecycle policies

---

## Features

**Current capabilities:**
- ✅ **Multi-cloud support** - AWS and Azure
- ✅ **AWS analyzers** - EC2, EBS, RDS, S3, ELB, Elastic IP
- ✅ **Azure analyzers** - VMs, Managed Disks, Storage, SQL, Public IPs
- ✅ Connect via cloud credentials (read-only recommended)
- ✅ Analyze last 7-30 days of usage
- ✅ Output top savings opportunities with estimated monthly savings
- ✅ Export report as JSON or terminal table
- ✅ Filter by minimum savings amount
- ✅ Comprehensive test suite (84 tests)

**Potential future additions:**
- GCP support (Compute Engine, Cloud Storage, Cloud SQL)
- Real-time pricing API integration
- Configuration file support
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
- Cloud credentials:
  - **AWS**: [AWS CLI configured](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) or environment variables
  - **Azure**: [Azure CLI logged in](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli) or environment variables

**Install via npm:**
```bash
npm install -g cloud-cost-cli
```

---

## Usage

**AWS scan:**
```bash
cloud-cost-cli scan --provider aws --profile default --region us-east-1
```

**Azure scan:**
```bash
# Set Azure subscription ID (or use --subscription-id flag)
export AZURE_SUBSCRIPTION_ID="your-subscription-id"

cloud-cost-cli scan --provider azure --location eastus
```

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

**Example output:**
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
├───┼──────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────────┼─────────────┤
│ 4 │ ELB      │ my-old-alb                             │ Delete unused load balancer                              │ $22.00      │
├───┼──────────┼────────────────────────────────────────┼──────────────────────────────────────────────────────────┼─────────────┤
│ 5 │ S3       │ logs-bucket-2023                       │ Add lifecycle policy to transition to Glacier            │ $938.00     │
└───┴──────────┴────────────────────────────────────────┴──────────────────────────────────────────────────────────┴─────────────┘

Total potential savings: $1,245/month ($14,940/year)

Summary: 47 resources analyzed | 12 idle | 8 oversized | 5 unused

💡 Note: Cost estimates based on us-east-1 pricing and may vary by region.
   For more accurate estimates, actual costs depend on your usage and region.
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

**Q: Can I run this in CI/CD?**  
A: Yes. Use `--output json` and parse the results to fail builds if savings exceed a threshold.

---

**Star this repo if it saves you money!** ⭐
