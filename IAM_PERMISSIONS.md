# Required IAM Permissions

This document lists the minimum IAM permissions needed for each analyzer.

## AWS Permissions

### Existing Analyzers (v0.4.0)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeAddresses",
        "rds:DescribeDBInstances",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "elasticloadbalancing:DescribeLoadBalancers",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

### Additional Analyzers (v0.6.0)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "ec2:DescribeNatGateways",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "logs:DescribeLogGroups",
        "ec2:DescribeSnapshots",
        "rds:DescribeDBSnapshots",
        "elasticache:DescribeCacheClusters",
        "ecs:ListClusters",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

### Combined Policy (All Analyzers)

For convenience, here's a single policy that grants all permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudCostCLIReadOnly",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "ec2:DescribeAddresses",
        "ec2:DescribeNatGateways",
        "ec2:DescribeSnapshots",
        "rds:DescribeDBInstances",
        "rds:DescribeDBSnapshots",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "elasticloadbalancing:DescribeLoadBalancers",
        "lambda:ListFunctions",
        "lambda:GetFunction",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "logs:DescribeLogGroups",
        "elasticache:DescribeCacheClusters",
        "ecs:ListClusters",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ecs:DescribeServices",
        "cloudwatch:GetMetricStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

## Azure Permissions

### Required Roles

The tool requires **Reader** role at the subscription level:

```bash
# Create service principal with Reader role
az ad sp create-for-rbac \
  --name "cloud-cost-cli" \
  --role "Reader" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID"
```

The Reader role includes all necessary `read` permissions for:
- Virtual Machines
- Disks
- Storage Accounts
- SQL Databases
- Public IP Addresses
- App Service Plans (v0.6.0)
- Azure Functions (v0.6.0)
- CosmosDB (v0.6.0)

## GCP Permissions

### Required Roles

The tool requires **Viewer** role at the project level:

```bash
# Using gcloud CLI
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/viewer"
```

### Required APIs

The following APIs must be enabled:

```bash
gcloud services enable compute.googleapis.com
gcloud services enable storage-api.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable monitoring.googleapis.com
```

## Troubleshooting Permission Errors

### AWS

If you see:
```
⚠️  Skipping Lambda functions - missing IAM permission: lambda:ListFunctions
```

Solution:
1. Add the missing permission to your IAM user/role
2. Or attach the ReadOnlyAccess managed policy (broader permissions)
3. Or use the combined policy above

### Azure

If you see:
```
⚠️  Skipping App Service Plans - insufficient permissions
```

Solution:
1. Ensure your service principal has Reader role at subscription level
2. Check: `az role assignment list --assignee YOUR_APP_ID`

### GCP

If you see:
```
⚠️  Skipping Cloud SQL - API not enabled
```

Solution:
1. Enable the required API: `gcloud services enable sqladmin.googleapis.com`
2. Or enable via Console: https://console.cloud.google.com/apis/library

## Best Practices

1. **Use read-only permissions** - Never grant write access to the tool
2. **Principle of least privilege** - Only grant permissions for analyzers you use
3. **Separate IAM users/roles** - Create dedicated credentials for the tool
4. **Rotate credentials regularly** - Treat these as sensitive credentials
5. **Monitor usage** - Use CloudTrail/Activity Log to audit API calls

## Future: Permission Checker

Planned for v0.6.0:

```bash
# Check which analyzers you have permissions for
cloud-cost-cli check-permissions --provider aws

# Output:
# ✅ EC2 - OK
# ✅ EBS - OK
# ❌ Lambda - Missing: lambda:ListFunctions
# ✅ RDS - OK
```
