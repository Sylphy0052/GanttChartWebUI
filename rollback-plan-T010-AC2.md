# T010-AC2 Rollback Plan: Dependency Undo/Redo Operations

## Overview
This document provides comprehensive rollback procedures for T010-AC2 implementation: "Dependency create/delete operations with undo/redo support". All rollback options are designed to be executed quickly with minimal risk.

## 🚨 Risk Assessment: VERY LOW
- ✅ **Purely additive implementation** - No existing files modified
- ✅ **No API changes** - Uses existing dependency endpoints
- ✅ **No database changes** - No schema modifications
- ✅ **Backward compatible** - Original useDependencies hook unchanged
- ✅ **Isolated changes** - Self-contained command implementation

## 📋 Files Added (For Reference)
```
/apps/web/src/lib/commands/DependencyCommand.ts                     (419 lines)
/apps/web/src/hooks/useDependenciesWithUndo.tsx                     (379 lines)  
/apps/web/src/components/gantt/DependencyUndoDemo.tsx               (419 lines)
/apps/web/src/lib/commands/__tests__/DependencyCommand.test.ts      (483 lines)
/T010-AC2-implementation-summary.md                                 (documentation)
/rollback-plan-T010-AC2.md                                          (this file)
```

## 🔄 Rollback Options (In Order of Preference)

### Option 1: Disable Undo Functionality (30 seconds) ⭐ RECOMMENDED
**Risk Level:** MINIMAL | **Downtime:** None | **Data Loss:** None

This option disables undo/redo for dependencies while keeping all code intact.

```typescript
// In any component using useDependenciesWithUndo
const dependencyState = useDependenciesWithUndo({
  projectId,
  enableUndo: false,  // 👈 Disable undo functionality
  // ... other options
})
```

**Benefits:**
- ✅ Instant rollback
- ✅ No file deletion required
- ✅ Easy to re-enable
- ✅ Code remains available for debugging

**Commands:**
```bash
# No file changes needed - just configuration change
echo "Undo disabled via configuration option"
```

---

### Option 2: Remove Demo Component (1 minute)
**Risk Level:** MINIMAL | **Downtime:** None | **Data Loss:** None

Remove the demo component while keeping core functionality.

**Steps:**
```bash
# Remove demo component
rm /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web/src/components/gantt/DependencyUndoDemo.tsx

# Remove demo from any imports (if added to main components)
# Check for any imports and remove manually
```

**Benefits:**
- ✅ Removes demo UI
- ✅ Core functionality preserved
- ✅ Tests remain available
- ✅ Quick execution

---

### Option 3: Fallback to Original Hook (2 minutes)
**Risk Level:** LOW | **Downtime:** None | **Data Loss:** None

Replace enhanced hook usage with original useDependencies hook.

**Steps:**
1. **Find all useDependenciesWithUndo usage:**
```bash
grep -r "useDependenciesWithUndo" /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web/src --include="*.tsx" --include="*.ts"
```

2. **Replace imports and hook calls:**
```typescript
// BEFORE (with undo)
import { useDependenciesWithUndo } from '@/hooks/useDependenciesWithUndo'
const { 
  dependencies, 
  createDependencyWithUndo, 
  deleteDependencyWithUndo 
} = useDependenciesWithUndo({ projectId })

// AFTER (original)
import { useDependencies } from '@/hooks/useDependencies'
const { 
  dependencies, 
  createDependency, 
  deleteDependency 
} = useDependencies(projectId)
```

3. **Update function calls:**
```typescript
// BEFORE
await createDependencyWithUndo(predId, succId)
await deleteDependencyWithUndo(predId, succId)

// AFTER
await createDependency(predId, succId)
await deleteDependency(predId, succId)
```

**Benefits:**
- ✅ Maintains all dependency functionality
- ✅ Removes only undo/redo capability
- ✅ Original behavior restored
- ✅ API calls unchanged

---

### Option 4: Complete File Removal (5 minutes)
**Risk Level:** LOW | **Downtime:** None | **Data Loss:** None

Remove all AC2-related files completely.

**Steps:**
```bash
# Navigate to project root
cd /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI

# Remove core implementation files
rm apps/web/src/lib/commands/DependencyCommand.ts
rm apps/web/src/hooks/useDependenciesWithUndo.tsx
rm apps/web/src/components/gantt/DependencyUndoDemo.tsx
rm apps/web/src/lib/commands/__tests__/DependencyCommand.test.ts

# Remove documentation files
rm T010-AC2-implementation-summary.md
rm rollback-plan-T010-AC2.md

# Verify no references remain
grep -r "DependencyCommand\|useDependenciesWithUndo\|DependencyUndoDemo" apps/web/src --include="*.tsx" --include="*.ts"

# If any references found, replace with original implementations
```

**Verification Commands:**
```bash
# Ensure tests pass
cd apps/web && npm test

# Ensure app builds
npm run build

# Check for any lingering imports
npm run lint
```

**Benefits:**
- ✅ Complete cleanup
- ✅ No trace of AC2 implementation
- ✅ Returns to pre-AC2 state
- ✅ Minimal risk due to additive nature

---

## 🧪 Validation After Rollback

### Functional Validation
Run these tests after any rollback option:

```bash
# 1. Application builds successfully
cd /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web
npm run build

# 2. Tests pass
npm test

# 3. Linting passes
npm run lint

# 4. Basic dependency operations work (manual test)
# - Open dependency management interface
# - Create a dependency
# - Delete a dependency
# - Verify API calls succeed
```

### API Validation
```bash
# Test dependency creation endpoint
curl -X POST http://localhost:3000/api/issues/task-1/dependencies \
  -H "Content-Type: application/json" \
  -d '{"predecessorId":"task-1","successorId":"task-2","type":"FS","lag":0}'

# Test dependency deletion endpoint  
curl -X DELETE http://localhost:3000/api/issues/task-1/dependencies \
  -H "Content-Type: application/json" \
  -d '{"successorId":"task-2"}'
```

### UI Validation
1. **Dependency Management Interface:** Verify basic create/delete works
2. **Gantt Chart Display:** Ensure dependency lines render correctly
3. **Task Selection:** Confirm task selection and validation works
4. **Error Handling:** Test error scenarios (invalid dependencies, etc.)

---

## 🚑 Emergency Rollback (1 minute)

If immediate rollback is needed:

```bash
# Quick disable via environment variable or config
export DISABLE_DEPENDENCY_UNDO=true

# Or rename files to disable imports
cd /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web/src
mv hooks/useDependenciesWithUndo.tsx hooks/useDependenciesWithUndo.tsx.disabled
mv lib/commands/DependencyCommand.ts lib/commands/DependencyCommand.ts.disabled

# Restart application
```

---

## 📊 Rollback Decision Matrix

| Scenario | Recommended Option | Time | Risk |
|----------|-------------------|------|------|
| **Minor issue found** | Option 1 (Disable) | 30s | Minimal |
| **Demo causing problems** | Option 2 (Remove Demo) | 1m | Minimal |
| **Undo logic issues** | Option 3 (Fallback Hook) | 2m | Low |
| **Complete revert needed** | Option 4 (Full Removal) | 5m | Low |
| **Emergency situation** | Emergency Rollback | 1m | Minimal |

---

## 🔍 Monitoring After Rollback

### Key Metrics to Watch
1. **API Error Rates:** Dependency creation/deletion endpoints
2. **User Interface Errors:** Dependency management components  
3. **Performance Metrics:** Dependency-related operations
4. **User Experience:** Feedback on dependency management functionality

### Log Monitoring
```bash
# Check for dependency-related errors
grep -i "dependency" /var/log/application.log

# Monitor API endpoints
grep -i "/api/issues/.*/dependencies" /var/log/api.log

# Watch for JavaScript errors
grep -i "DependencyCommand\|useDependenciesWithUndo" /var/log/frontend.log
```

---

## 📝 Post-Rollback Actions

### Immediate Actions (First 30 minutes)
1. ✅ **Verify core functionality** works as expected
2. ✅ **Monitor error logs** for any unexpected issues
3. ✅ **Test dependency operations** manually
4. ✅ **Confirm user interface** displays correctly

### Short-term Actions (First 24 hours)  
1. ✅ **Analyze rollback reason** and document root cause
2. ✅ **Plan improvement strategy** if re-implementation needed
3. ✅ **Update stakeholders** on rollback status and timeline
4. ✅ **Review monitoring metrics** for any anomalies

### Documentation Updates
1. **Update status**: Mark AC2 as "Rolled Back" in tracking systems
2. **Document lessons learned**: Record what caused the rollback
3. **Update implementation plan**: Revise approach for future attempt
4. **Notify team members**: Ensure all developers aware of rollback

---

## ✅ Rollback Checklist

### Pre-Rollback
- [ ] **Identify rollback trigger** and document the reason
- [ ] **Choose appropriate rollback option** based on severity and urgency
- [ ] **Backup current state** (git commit current changes)
- [ ] **Notify team members** of planned rollback
- [ ] **Prepare validation steps** for post-rollback testing

### During Rollback
- [ ] **Execute rollback steps** according to chosen option
- [ ] **Verify each step** completes successfully
- [ ] **Document any issues** encountered during rollback
- [ ] **Take screenshots/logs** of rollback process

### Post-Rollback
- [ ] **Run validation tests** to confirm system stability
- [ ] **Monitor application performance** for first hour
- [ ] **Test dependency operations** manually
- [ ] **Update project status** and documentation
- [ ] **Plan next steps** for addressing the original issue

---

## 📞 Support and Escalation

### Internal Support
- **Developer Team**: For technical rollback assistance
- **QA Team**: For validation and testing support  
- **DevOps Team**: For deployment and monitoring support

### Escalation Path
1. **Level 1**: Development team lead
2. **Level 2**: Technical architect  
3. **Level 3**: Project management
4. **Level 4**: Stakeholder notification

### Documentation
- All rollback activities should be logged in project management system
- Technical details documented in engineering wiki
- User-facing impact communicated through standard channels

---

*This rollback plan provides comprehensive options for safely reverting T010-AC2 implementation with minimal risk and maximum preservation of existing functionality.*