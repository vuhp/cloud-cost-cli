# v0.1.0 - Initial Release 🚀

**First public release of cloud-cost-cli** - Find cloud cost savings in seconds!

## 🎯 What's Included

### AWS Cost Analyzers (6 types)
- ✅ **EC2** - Detect idle instances (< 5% CPU over 30 days)
- ✅ **EBS** - Find unattached volumes (> 7 days old)
- ✅ **RDS** - Identify oversized databases (< 20% CPU)
- ✅ **S3** - Flag buckets without lifecycle policies
- ✅ **ELB** - Detect unused load balancers (no healthy targets)
- ✅ **EIP** - Find unattached Elastic IPs

### Features
- 🚀 **Parallel execution** - All analyzers run simultaneously for speed
- 📊 **Multiple output formats** - Terminal table (default) and JSON
- 💰 **Cost estimation** - Real AWS pricing for us-east-1
- 🔐 **Flexible auth** - Environment variables, AWS profiles, or explicit credentials
- 🌍 **Region support** - Auto-detect from profile config or specify via `--region`
- 📝 **Comprehensive docs** - Installation guide, contributing guide, IAM policy template

## 📦 Installation

```bash
# Run without installing
npx cloud-cost-cli scan

# Or install globally
npm install -g cloud-cost-cli

# Or use with specific version
npx cloud-cost-cli@0.1.0 scan
```

## 🚀 Quick Start

```bash
# Basic scan (uses default AWS credentials)
cloud-cost-cli scan

# Scan specific region
cloud-cost-cli scan --region us-west-2

# Use AWS profile
cloud-cost-cli scan --profile production

# JSON output for scripting
cloud-cost-cli scan --output json > report.json
```

## 📚 Documentation

- [Installation Guide](https://github.com/vuhp/cloud-cost-cli/blob/main/docs/installation.md)
- [IAM Policy Template](https://github.com/vuhp/cloud-cost-cli/blob/main/docs/iam-policy.json)
- [Contributing Guide](https://github.com/vuhp/cloud-cost-cli/blob/main/docs/contributing.md)
- [Release Process](https://github.com/vuhp/cloud-cost-cli/blob/main/docs/RELEASE.md)

## 🔒 Required Permissions

Read-only IAM permissions for:
- EC2 (instances, volumes, addresses)
- RDS (DB instances)
- S3 (list buckets, lifecycle configs)
- ELB (load balancers, target groups)
- CloudWatch (metrics)
- Cost Explorer (cost data)

See [iam-policy.json](https://github.com/vuhp/cloud-cost-cli/blob/main/docs/iam-policy.json) for the complete policy.

## 🎯 Roadmap

- [ ] GCP support
- [ ] Azure support
- [ ] More AWS services (Lambda, DynamoDB, CloudFront)
- [ ] Historical cost trending
- [ ] Slack/Discord notifications
- [ ] CI/CD integration examples
- [ ] Interactive TUI mode
- [ ] Cost optimization recommendations API

## 💖 Support This Project

If this tool saves you money, consider sponsoring:
- [GitHub Sponsors](https://github.com/sponsors/vuhp)

## 🐛 Issues & Feedback

Found a bug or have a feature request?
- [Open an issue](https://github.com/vuhp/cloud-cost-cli/issues)
- [Discussions](https://github.com/vuhp/cloud-cost-cli/discussions)

## 📝 License

MIT License - see [LICENSE](https://github.com/vuhp/cloud-cost-cli/blob/main/LICENSE)

---

**npm package**: https://www.npmjs.com/package/cloud-cost-cli  
**GitHub repo**: https://github.com/vuhp/cloud-cost-cli

Thank you for trying cloud-cost-cli! 🙏
