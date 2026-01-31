# Release Process

This document describes how to publish a new version of cloud-cost-cli.

## Prerequisites

### npm Trusted Publishing (OIDC)

This project uses **npm trusted publishing** via GitHub Actions. No npm token is required!

**Configuration:**
- Already configured on npm for this package
- GitHub Actions is set as a trusted publisher
- Publishing happens automatically via OIDC (OpenID Connect)

**Benefits:**
- ✅ No tokens to rotate or secure
- ✅ No 2FA required for automation
- ✅ More secure (GitHub's identity proves authenticity)
- ✅ Automatic provenance statements

## Steps to Release

### 1. Update Version

```bash
# Bump version (choose one)
npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
npm version minor   # 0.1.0 → 0.2.0 (new features)
npm version major   # 0.1.0 → 1.0.0 (breaking changes)

# Push version commit and tag
git push && git push --tags
```

### 2. Create GitHub Release

**Option A: Via GitHub UI**
1. Go to https://github.com/vuhp/cloud-cost-cli/releases/new
2. Choose the version tag (e.g., `v0.1.0`)
3. Title: `v0.1.0 - Initial Release`
4. Description: Add release notes (features, fixes, breaking changes)
5. Click **Publish release**

**Option B: Via GitHub CLI**
```bash
gh release create v0.1.0 \
  --title "v0.1.0 - Initial Release" \
  --notes "First public release with AWS support"
```

### 3. Automated Publishing

Once you publish the GitHub release:
- GitHub Actions workflow triggers automatically
- Builds the TypeScript code
- Publishes to npm with provenance
- Package is live at https://www.npmjs.com/package/cloud-cost-cli

### 4. Verify

```bash
# Check npm
npm view cloud-cost-cli

# Test installation
npx cloud-cost-cli@latest --version
```

## Release Notes Template

```markdown
## What's New

### Features
- ✨ Add XYZ analyzer
- 🚀 Improve performance by 2x

### Bug Fixes
- 🐛 Fix region handling for profiles
- 🐛 Correct cost calculation for RDS

### Documentation
- 📝 Add examples for GCP
- 📝 Update IAM policy

### Breaking Changes
- ⚠️ Rename `--days` to `--period`

## Installation

\`\`\`bash
npm install -g cloud-cost-cli
# or
npx cloud-cost-cli scan
\`\`\`

**Full Changelog**: https://github.com/vuhp/cloud-cost-cli/compare/v0.0.9...v0.1.0
```

## Rollback

If something goes wrong:

```bash
# Deprecate the broken version
npm deprecate cloud-cost-cli@0.1.0 "Broken release, use 0.1.1"

# Publish a patch
npm version patch
git push && git push --tags
# Then create new GitHub release
```

## Manual Publishing (Emergency Only)

If GitHub Actions fails:

```bash
npm run build
npm login
npm publish --access public
```

## Checklist

Before releasing:
- [ ] All tests pass
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] README.md reflects new features
- [ ] Git tag created
- [ ] GitHub release published
- [ ] npm package verified
- [ ] Announcement posted (Twitter, HN, etc.)
