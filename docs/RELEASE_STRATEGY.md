# Release Strategy & Version Management - M10-05

## Overview

This document defines the unified version management system and release branch strategy for the GanttChart WebUI monorepo, implementing M10-05 requirements for consistent versioning across all components.

## Version Management System

### Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/) strictly:

- **MAJOR.MINOR.PATCH** (e.g., `1.0.0`)
- **MAJOR**: Breaking changes that require migration
- **MINOR**: New features that are backward-compatible  
- **PATCH**: Bug fixes and minor improvements

### Version Synchronization

All components maintain **unified versioning**:
- `/package.json` (root)
- `/backend/package.json`
- `/frontend/package.json`

**All versions MUST be identical** - no independent component versioning.

## Automated Version Management

### Version Manager Script

Location: `/scripts/version-manager.js`

#### Core Commands

```bash
# Check version consistency
npm run version:check

# Set specific version
npm run version:set 1.2.3

# Semantic version bumping
npm run version:bump:patch    # 1.0.0 → 1.0.1
npm run version:bump:minor    # 1.0.0 → 1.1.0
npm run version:bump:major    # 1.0.0 → 2.0.0

# Git tag management
npm run version:tag           # Tag current version
npm run version:tag 1.2.3     # Tag specific version

# Release notes generation
npm run version:notes v1.0.0 v1.1.0
```

#### Full Release Commands

```bash
# Local releases (no git push)
npm run release:patch
npm run release:minor
npm run release:major

# Remote releases (with git push)
npm run release:patch:push
npm run release:minor:push
npm run release:major:push
```

## Branch Strategy

### Main Branches

1. **`main`** - Production-ready code
   - Protected branch with required PR reviews
   - Direct commits forbidden
   - All releases are tagged from main

2. **`develop`** - Integration branch
   - Latest development changes
   - Feature branches merge here first
   - Regular merges to main for releases

### Release Branches

#### Release Branch Workflow

1. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.1.0
   ```

2. **Version Bump & Finalization**
   ```bash
   npm run version:bump:minor
   # Final testing, bug fixes only
   git commit -am "chore: bump version to v1.1.0"
   ```

3. **Merge to Main**
   ```bash
   git checkout main
   git merge --no-ff release/v1.1.0
   npm run version:tag
   git push origin main --tags
   ```

4. **Back-merge to Develop**
   ```bash
   git checkout develop
   git merge --no-ff main
   git push origin develop
   ```

5. **Cleanup**
   ```bash
   git branch -d release/v1.1.0
   git push origin --delete release/v1.1.0
   ```

### Hotfix Workflow

For urgent production fixes:

1. **Create Hotfix Branch from Main**
   ```bash
   git checkout main
   git checkout -b hotfix/v1.0.1
   ```

2. **Fix & Version Bump**
   ```bash
   # Apply fixes
   npm run version:bump:patch
   git commit -am "fix: critical security patch"
   ```

3. **Merge to Main**
   ```bash
   git checkout main
   git merge --no-ff hotfix/v1.0.1
   npm run version:tag
   git push origin main --tags
   ```

4. **Merge to Develop**
   ```bash
   git checkout develop
   git merge --no-ff hotfix/v1.0.1
   git push origin develop
   ```

## Release Process

### Pre-Release Checklist

- [ ] All tests pass (`npm test`)
- [ ] Version consistency check (`npm run version:check`)
- [ ] CHANGELOG.md updated
- [ ] Breaking changes documented
- [ ] Security review completed
- [ ] Performance benchmarks stable

### Release Execution

#### Automated Release Process

```bash
# Full automated release (patch)
npm run release:patch:push

# With custom message
node scripts/version-manager.js release patch "Bug fixes and improvements" --push
```

#### Manual Release Process

1. **Prepare Release**
   ```bash
   npm run version:check           # Verify consistency
   npm test                        # Run all tests
   npm run build                   # Verify builds
   ```

2. **Version & Tag**
   ```bash
   npm run version:bump:minor      # Or patch/major
   git add .
   git commit -m "chore: release v1.1.0"
   npm run version:tag
   ```

3. **Push Release**
   ```bash
   git push origin main --tags
   ```

### Post-Release Activities

1. **Update Documentation**
   - Update CHANGELOG.md
   - Update README.md if needed
   - Generate release notes

2. **Deploy to Production**
   - Trigger CI/CD pipeline
   - Monitor deployment
   - Verify production functionality

3. **Communicate Release**
   - Notify stakeholders
   - Update project management tools
   - Archive release artifacts

## Git Tag Management

### Tag Naming Convention

- **Release Tags**: `v1.0.0`, `v1.1.0`, `v2.0.0`
- **Pre-release Tags**: `v1.1.0-alpha.1`, `v1.1.0-beta.1`
- **Hotfix Tags**: `v1.0.1`, `v1.0.2`

### Tag Messages

```bash
# Release tag with generated notes
npm run version:notes v1.0.0 HEAD > release-notes.txt
git tag -a v1.1.0 -F release-notes.txt

# Simple release tag
git tag -a v1.1.0 -m "Release v1.1.0 - New features and improvements"
```

## Version Consistency Validation

### Automated Checks

The version manager performs these validations:

1. **Semantic Version Format**: Valid semver pattern
2. **Component Synchronization**: All package.json files match
3. **Git Tag Consistency**: Tags match package.json versions
4. **Changelog Alignment**: Version entries in CHANGELOG.md

### CI/CD Integration

```yaml
# .github/workflows/version-check.yml
name: Version Consistency Check
on: [push, pull_request]
jobs:
  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check Version Consistency
        run: npm run version:check
```

## Release Notes Generation

### Automated Generation

```bash
# Generate notes between tags
npm run version:notes v1.0.0 v1.1.0

# Generate notes from last tag to HEAD
npm run version:notes $(git describe --tags --abbrev=0)
```

### Commit Message Conventions

For automated release notes categorization:

- `feat:` → **Added** section
- `fix:` → **Fixed** section  
- `refactor:` → **Changed** section
- `docs:` → **Documentation** section
- `test:` → **Testing** section

## Emergency Procedures

### Rollback Release

```bash
# Revert to previous version
git checkout main
git reset --hard v1.0.0
npm run version:set 1.0.0
git push --force-with-lease origin main

# Remove bad tag
git tag -d v1.0.1
git push origin :refs/tags/v1.0.1
```

### Fix Version Inconsistency

```bash
# Force synchronize to a specific version
npm run version:set 1.0.0

# Verify fix
npm run version:check
```

## Migration Guide

### Upgrading to Version Manager

1. **Install Dependencies**
   ```bash
   # No additional dependencies required
   # Uses Node.js built-in modules only
   ```

2. **Update Scripts**
   ```bash
   # Replace old version scripts in package.json
   npm run version:check    # New unified command
   ```

3. **Verify Setup**
   ```bash
   node scripts/version-manager.js help
   npm run version:check
   ```

## Best Practices

### Version Bumping

- **Patch**: Bug fixes, security patches, minor improvements
- **Minor**: New features, API additions (backward compatible)
- **Major**: Breaking changes, API removals, architecture changes

### Release Timing

- **Patch Releases**: As needed (hotfixes, critical bugs)
- **Minor Releases**: Monthly or bi-weekly feature releases
- **Major Releases**: Quarterly or bi-annually

### Documentation

- Always update CHANGELOG.md before release
- Include migration guides for major releases
- Document breaking changes clearly
- Provide upgrade/downgrade instructions

### Testing Strategy

- All tests must pass before any release
- Performance regression tests for major releases
- Cross-browser testing for frontend changes
- Database migration testing for backend changes

## Troubleshooting

### Common Issues

1. **Version Mismatch Error**
   ```bash
   # Solution: Force synchronization
   npm run version:set $(node -p "require('./package.json').version")
   ```

2. **Git Tag Conflicts**
   ```bash
   # Solution: Delete and recreate tag
   git tag -d v1.0.0
   git push origin :refs/tags/v1.0.0
   npm run version:tag
   ```

3. **Release Script Failures**
   ```bash
   # Solution: Manual step-by-step release
   npm run version:check
   npm run version:bump:patch
   git add . && git commit -m "chore: release"
   npm run version:tag
   ```

## Support & Resources

- **Issues**: Report version management issues via GitHub Issues
- **Documentation**: See `/docs/` for additional guides
- **Scripts**: All automation in `/scripts/version-manager.js`
- **Configuration**: Version settings in `package.json` files

---

**Last Updated**: 2025-01-15  
**Version**: 1.0.0  
**Document Status**: Active