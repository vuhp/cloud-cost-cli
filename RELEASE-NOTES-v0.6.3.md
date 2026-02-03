# v0.6.3 Release Notes

**Release Date:** 2026-02-03  
**Theme:** Multi-Region Scanning & Progress Tracking

---

## ✨ New Features

### 1. Multi-Region Scanning (AWS)
Scan all AWS regions at once to find forgotten resources:

```bash
cloud-cost-cli scan --provider aws --all-regions
```

- Discovers all enabled regions automatically
- Parallel scanning with batching (avoids throttling)
- Tags resources with region (`[us-west-2] i-abc123`)
- Shows regional breakdown in results

### 2. Comparison Mode
Track your cost optimization progress over time:

```bash
cloud-cost-cli scan --provider aws
cloud-cost-cli compare  # Compare with previous scan
```

Shows:
- ✅ Resolved opportunities (fixed)
- 🆕 New opportunities (found)
- 📉 Improved (savings reduced)
- 📈 Worsened (more waste)
- 💰 Net change (overall progress)

### 3. GitHub Action Example
Pre-built workflow for CI/CD integration:

```bash
cp examples/github-action/workflow.yml .github/workflows/cloud-cost-scan.yml
```

Features:
- Scheduled scans (weekly, daily)
- Manual triggers
- Artifact uploads
- PR comments
- Fail on threshold

---

## 🚀 Quick Start

```bash
# Install latest version
npm install -g cloud-cost-cli@0.6.3

# Multi-region scan
cloud-cost-cli scan --provider aws --all-regions

# Track progress
cloud-cost-cli compare
```

---

## 📊 Changes

### Added
- `--all-regions` flag for AWS multi-region scanning
- `compare` command for tracking optimization progress
- Automatic report saving (enables comparison)
- `examples/github-action/` with CI/CD template

### Improved
- Updated README with new features
- More concise documentation

---

## 📝 Usage Examples

### Multi-Region Example
```bash
$ cloud-cost-cli scan --provider aws --all-regions

Scanning all AWS regions...
Found 17 enabled regions

Scanning batch 1/4: us-east-1, us-east-2, us-west-1, us-west-2, ca-central-1
✓ us-east-1: Found 12 opportunities
✓ us-west-2: Found 5 opportunities
...

📊 Region Breakdown:
  us-east-1: 12 opportunities, $450.00/month
  us-west-2: 5 opportunities, $180.50/month
  eu-west-1: 3 opportunities, $95.25/month
```

### Comparison Example
```bash
$ cloud-cost-cli compare

📊 Cost Optimization Comparison Report

Summary:
  Previous: $1,245.00/month
  Current:  $890.50/month
  Net change: 📉 -$354.50/month

✅ Resolved (3): $210.00/month saved
🆕 New (2): $85.50/month waste found
```

---

## 🔗 Links

- npm: https://www.npmjs.com/package/cloud-cost-cli
- GitHub: https://github.com/vuhp/cloud-cost-cli
- Examples: `examples/github-action/`

---

**Happy cost optimizing!** 🚀
