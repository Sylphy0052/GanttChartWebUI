# T037: Frontend Bundle Size Optimization - Rollback Plan

**Date**: 2025-09-07  
**Implementation**: Bundle size optimization with lazy loading and webpack configuration

## Rollback Strategy

### Immediate Rollback (5 minutes)

If bundle optimization causes critical issues:

```bash
# 1. Revert Next.js configuration
git checkout HEAD~1 next.config.js

# 2. Remove bundle analyzer dependency
npm uninstall @next/bundle-analyzer

# 3. Rebuild without optimizations
npm run build

# 4. Restart application
npm run start
```

### Partial Rollback Options

#### Option A: Keep webpack optimizations, remove lazy loading

```bash
# Remove lazy loading components
rm -rf src/components/dynamic/

# Update imports in progress-demo-optimized page
# Replace lazy imports with direct imports
```

#### Option B: Keep lazy loading, revert webpack config

```bash
# Revert only the webpack configuration parts
git show HEAD~1:next.config.js > next.config.js.backup
# Manually merge safe parts back
```

### Complete Rollback (10 minutes)

```bash
# 1. Identify the commit before T037 implementation
git log --oneline | grep -B5 -A5 "T037\|bundle"

# 2. Revert all T037 changes
git revert <commit-hash>

# 3. Remove new files
rm -rf src/components/dynamic/
rm scripts/bundle-analysis.js
rm src/lib/bundle-analysis.ts
rm src/app/progress-demo-optimized/

# 4. Clean build and reinstall
rm -rf .next
npm ci
npm run build
```

## Risk Assessment

### Low Risk Changes
- ✅ Bundle analysis tools (can be safely removed)
- ✅ Progress demo optimized page (standalone feature)
- ✅ Lazy loading wrappers (graceful fallback)

### Medium Risk Changes  
- ⚠️ Webpack chunk splitting (may affect existing chunks)
- ⚠️ Package imports optimization (could break some imports)

### High Risk Changes
- ❌ None - all changes are non-breaking

## Validation After Rollback

```bash
# 1. Verify build works
npm run build

# 2. Test key functionality
npm run e2e:critical

# 3. Check bundle size returned to baseline
node scripts/bundle-analysis.js || echo "Analysis script removed"

# 4. Verify all pages load correctly
npm run start
# Manual test: /, /gantt, /projects, /progress-management-demo
```

## Emergency Contacts

- **Frontend Lead**: [Contact info]
- **DevOps**: [Contact info]  
- **On-call Engineer**: [Contact info]

## Post-Rollback Actions

1. **Document the issue** that caused rollback
2. **File bug report** with reproduction steps
3. **Update monitoring** to detect similar issues
4. **Plan fix implementation** with safer approach

## Prevention for Future

1. **Feature flags** for bundle optimizations
2. **Gradual rollout** with user percentage
3. **Enhanced monitoring** for bundle size regressions
4. **Automated testing** for chunk loading

## Files That Will Be Reverted

### New Files (will be deleted):
- `src/components/dynamic/LazyGanttBarWithUndo.tsx`
- `src/components/dynamic/LazyGanttChart.tsx`
- `src/components/dynamic/LazyBatchProgressUpdateModal.tsx`
- `src/components/dynamic/LazyProgressManagementSystem.tsx`
- `src/components/dynamic/index.ts`
- `src/lib/bundle-analysis.ts`
- `scripts/bundle-analysis.js`
- `src/app/progress-demo-optimized/page.tsx`
- `docs/T037-bundle-optimization-report.md`

### Modified Files (will be reverted):
- `next.config.js` - Back to basic configuration
- `package.json` - Remove bundle analysis scripts and @next/bundle-analyzer

This rollback plan ensures quick recovery while maintaining system stability.