# T010 Rollback Plan - AC1: Bar Move/Resize Undo/Redo

## Overview
This document provides a comprehensive rollback strategy for the first acceptance criterion of T010: "Bar move/resize undo/redo with Ctrl+Z/Y". The implementation adds command pattern-based undo/redo functionality to Gantt bar operations.

## Implementation Summary

### Files Added
```
/apps/web/src/lib/commands/BaseCommand.ts                     - Command pattern foundation
/apps/web/src/lib/commands/BarOperationCommand.ts             - Bar-specific commands  
/apps/web/src/hooks/useUndoRedo.tsx                          - Main undo/redo hook
/apps/web/src/components/gantt/GanttBarWithUndo.tsx          - Enhanced bar component
/apps/web/src/components/gantt/UndoRedoDemo.tsx              - Demo/test component
```

### Files Modified
```
None - This is an additive implementation that doesn't modify existing files
```

## Rollback Procedures

### Option 1: Complete Rollback (Recommended for Issues)
**Risk Level:** Low  
**Time Required:** 5 minutes  
**Impact:** Removes all undo/redo functionality, reverts to original behavior

```bash
# Step 1: Remove added files
rm /apps/web/src/lib/commands/BaseCommand.ts
rm /apps/web/src/lib/commands/BarOperationCommand.ts  
rm /apps/web/src/hooks/useUndoRedo.tsx
rm /apps/web/src/components/gantt/GanttBarWithUndo.tsx
rm /apps/web/src/components/gantt/UndoRedoDemo.tsx

# Step 2: Remove commands directory if empty
rmdir /apps/web/src/lib/commands/ 2>/dev/null || true

# Step 3: Verify no imports exist (search for usage)
grep -r "useUndoRedo\|BarOperationCommand\|GanttBarWithUndo" /apps/web/src/ || echo "No references found"

# Step 4: Test original functionality
npm run dev
# Navigate to Gantt chart and verify bar operations work as before
```

### Option 2: Selective Rollback (Keep Infrastructure)
**Risk Level:** Very Low  
**Time Required:** 2 minutes  
**Impact:** Removes enhanced bar component, keeps command infrastructure for future use

```bash
# Step 1: Remove only the enhanced bar component and demo
rm /apps/web/src/components/gantt/GanttBarWithUndo.tsx
rm /apps/web/src/components/gantt/UndoRedoDemo.tsx

# Step 2: Keep command infrastructure for other ACs
# (BaseCommand.ts, BarOperationCommand.ts, useUndoRedo.tsx remain)

# Step 3: Update any imports to use original GanttBar
# (No changes needed if not integrated yet)
```

### Option 3: Disable Undo/Redo (Quick Fix)
**Risk Level:** Very Low  
**Time Required:** 1 minute  
**Impact:** Keeps code but disables undo/redo functionality

```typescript
// In useUndoRedo.tsx, modify options defaults:
const useUndoRedo = (options: UndoRedoOptions = {}): UndoRedoHookResult => {
  const {
    maxHistorySize = 0,                    // Disable history
    enableKeyboardShortcuts = false,       // Disable shortcuts  
    telemetryEnabled = false,             // Disable telemetry
    // ... rest remains same
  } = options
```

## Risk Assessment

### Low Risk - Additive Implementation
- ✅ No existing files modified
- ✅ No breaking changes to existing functionality
- ✅ Original GanttBar component unchanged
- ✅ New components are isolated
- ✅ No database/API changes required

### Potential Issues & Solutions

| Issue | Probability | Impact | Solution |
|-------|------------|---------|----------|
| Memory leaks from command history | Low | Medium | Option 3: Disable history (set maxHistorySize: 0) |
| Performance degradation | Low | Low | Option 3: Disable telemetry and shortcuts |
| Keyboard shortcut conflicts | Medium | Low | Option 3: Set enableKeyboardShortcuts: false |
| Command execution failures | Low | Medium | Option 1: Complete rollback |

## Validation Steps

### After Rollback - Verify Original Functionality:
1. **Bar Movement:** Click and drag task bars - should work as before
2. **Bar Resizing:** Drag left/right edges - should work as before  
3. **Progress Updates:** Drag progress bars - should work as before
4. **No Undo/Redo:** Ctrl+Z/Y should have no effect (expected)
5. **Performance:** No degradation in drag operations
6. **Console:** No command-related errors

### Rollback Success Criteria:
- [ ] All bar operations function identically to pre-implementation
- [ ] No console errors related to commands/undo-redo
- [ ] No memory leaks or performance issues
- [ ] Keyboard shortcuts don't interfere with browser defaults
- [ ] No visual artifacts from removed components

## Emergency Contacts & Escalation

### If Rollback Fails:
1. **Check for lingering imports:** Search all files for undo/redo references
2. **Clear browser cache:** Force refresh (Ctrl+F5) 
3. **Restart dev server:** Kill and restart npm run dev
4. **Database:** No database changes made, no cleanup needed

### Escalation Path:
1. Try Option 3 (disable) first - lowest risk
2. Try Option 2 (selective) if issues persist
3. Use Option 1 (complete) as last resort
4. If still failing, revert to last known good commit

## Future Considerations

### For Next AC Implementation:
- Command infrastructure can be reused (BaseCommand.ts, useUndoRedo.tsx)
- Consider integration strategy to avoid duplication
- Plan for gradual rollout using feature flags

### Lessons Learned:
- Additive approach minimizes rollback risk
- Keep original components unchanged during development
- Comprehensive demo components aid in testing and validation

## Testing Rollback

### Pre-Rollback Checklist:
- [ ] Document current state (screenshot Gantt functionality)
- [ ] Note any custom configurations or modifications
- [ ] Backup current branch/commit hash
- [ ] Verify test data/projects available for validation

### Post-Rollback Testing:
```bash
# 1. Start application
npm run dev

# 2. Navigate to Gantt chart page
# 3. Test each operation:
#    - Click task bar (selection)
#    - Drag task bar (move)
#    - Drag left edge (resize start)
#    - Drag right edge (resize end) 
#    - Drag progress bar (progress update)
#    - Try Ctrl+Z/Y (should do nothing)

# 4. Check console for errors
# 5. Monitor performance during operations
```

## Summary

This rollback plan provides multiple options with increasing levels of intervention:

1. **Disable** (safest, quickest) - Turn off undo/redo while keeping code
2. **Selective removal** (safe, quick) - Remove UI components, keep infrastructure  
3. **Complete removal** (definitive) - Remove all added functionality

The additive nature of this implementation makes rollback low-risk and straightforward. The original GanttBar component remains unchanged and can be used as a fallback at any time.

**Recommended approach:** Start with Option 3 (disable) for quick resolution, then proceed to Option 1 (complete removal) if a permanent rollback is needed.