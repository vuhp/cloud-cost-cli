# Cloud Cost CLI - Installation & Usage

## Quick Start

### Prerequisites

- Node.js >= 18
- AWS account with configured credentials
- IAM permissions (see [iam-policy.json](./iam-policy.json))

### Installation

**Option 1: npm (recommended)**

```bash
npm install -g cloud-cost-cli
```

**Option 2: npx (no install)**

```bash
npx cloud-cost-cli scan
```

**Option 3: Clone and run locally**

```bash
git clone https://github.com/vuhp/cloud-cost-cli.git
cd cloud-cost-cli
npm install
npm run dev -- scan
```

---

## AWS Credentials Setup

The CLI uses standard AWS credential resolution. Choose one method:

### Method 1: AWS CLI (easiest)

```bash
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, and default region.

### Method 2: Environment variables

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### Method 3: Named profile

```bash
# In ~/.aws/credentials:
[production]
aws_access_key_id = your-access-key
aws_secret_access_key = your-secret-key

# Use with CLI:
cloud-cost-cli scan --profile production
```

---

## IAM Permissions

Create an IAM user or role with the following policy for read-only access:

[**View full IAM policy**](./iam-policy.json)

**Summary of required permissions:**
- EC2: DescribeInstances, DescribeVolumes, DescribeAddresses
- RDS: DescribeDBInstances
- S3: ListAllMyBuckets, GetBucketLifecycleConfiguration
- ELB: DescribeLoadBalancers, DescribeTargetGroups, DescribeTargetHealth
- CloudWatch: GetMetricStatistics
- Cost Explorer: GetCostAndUsage

---

## Usage Examples

### Basic scan (default region)

```bash
cloud-cost-cli scan
```

### Scan specific region

```bash
cloud-cost-cli scan --region us-west-2
```

### Show top 10 opportunities

```bash
cloud-cost-cli scan --top 10
```

### JSON output (for scripting)

```bash
cloud-cost-cli scan --output json > report.json
```

### Filter by minimum savings

```bash
cloud-cost-cli scan --min-savings 50
```

Only show opportunities that save >= $50/month.

### Custom analysis period

```bash
cloud-cost-cli scan --days 60
```

Analyze usage over the last 60 days instead of default 30.

### Use with specific AWS profile

```bash
cloud-cost-cli scan --profile production
```

---

## Sample Output

```
Cloud Cost Optimization Report
Provider: aws | Region: us-east-1 | Account: 123456789012
Analyzed: 2026-01-01 to 2026-01-31

Top 5 Savings Opportunities (est. $1,245.00/month):

┌───┬──────┬─────────────────────────┬──────────────────────────────────────────────────┬─────────────┐
│ # │ Type │ Resource ID             │ Recommendation                                   │ Savings/mo  │
├───┼──────┼─────────────────────────┼──────────────────────────────────────────────────┼─────────────┤
│ 1 │ S3   │ logs-bucket-2023        │ Enable lifecycle policy (Intelligent-Tiering or… │ $938.00     │
│ 2 │ RDS  │ mydb-production         │ Downsize to db.t3.large (avg CPU: 15.0%, avg c… │ $180.00     │
│ 3 │ EC2  │ i-0abc123def456         │ Stop instance or downsize to t3.small (avg CPU:… │ $65.00      │
│ 4 │ EBS  │ vol-0xyz789abc          │ Snapshot and delete, or delete if redundant (ag… │ $40.00      │
│ 5 │ ELB  │ my-old-alb              │ Delete unused load balancer (no active targets)  │ $22.00      │
└───┴──────┴─────────────────────────┴──────────────────────────────────────────────────┴─────────────┘

Total potential savings: $1,245.00/month ($14,940.00/year)

Summary: 42 resources analyzed | 3 idle | 2 oversized | 5 unused
```

---

## Troubleshooting

### Error: AWS credentials not found

**Solution:** Run `aws configure` or set environment variables as shown above.

### Error: Access Denied

**Solution:** Ensure your IAM user/role has the required read-only permissions. See [iam-policy.json](./iam-policy.json).

### Error: Region not enabled

**Solution:** The specified region is not enabled in your AWS account. Try a different region or enable it in the AWS Console.

### No opportunities found

**Possible reasons:**
- Your account is already well-optimized!
- Analysis period might be too short (try `--days 60`)
- Minimum savings filter is too high (remove `--min-savings` or lower the threshold)

---

## CI/CD Integration

Use the CLI in your CI pipeline to catch cost issues early:

```bash
# In GitHub Actions, GitLab CI, etc.
npx cloud-cost-cli scan --output json --min-savings 100 > cost-report.json

# Fail the build if savings exceed threshold
SAVINGS=$(jq '.totalPotentialSavings' cost-report.json)
if (( $(echo "$SAVINGS > 500" | bc -l) )); then
  echo "WARNING: Potential savings of \$${SAVINGS}/month detected!"
  exit 1
fi
```

---

## Next Steps

- Star the repo: https://github.com/vuhp/cloud-cost-cli
- Sponsor the project: https://github.com/sponsors/vuhp
- Report issues: https://github.com/vuhp/cloud-cost-cli/issues
- Contribute: https://github.com/vuhp/cloud-cost-cli/pulls
