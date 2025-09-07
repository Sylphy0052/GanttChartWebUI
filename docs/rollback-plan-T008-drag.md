# Rollback Plan: T008 Gantt Bar Drag Implementation

## Overview

This rollback plan provides steps to safely revert the drag functionality implementation for GanttBar components if issues arise in production.

## Risk Assessment

**Risk Level**: LOW
- Implementation is additive and backward compatible
- Original functionality preserved
- New features are opt-in via props
- No breaking changes to existing components

## Rollback Scenarios

### Scenario 1: Performance Issues
**Symptoms**: Drag operations exceed 100ms performance threshold, memory leaks
**Action**: Disable drag functionality only

### Scenario 2: API Integration Issues  
**Symptoms**: Task updates fail, data inconsistency
**Action**: Revert API integration, keep visual feedback

### Scenario 3: Complete Rollback
**Symptoms**: Critical bugs, component crashes
**Action**: Full rollback to previous version

## Rollback Procedures

### Quick Disable (Recommended First Step)

1. **Disable drag functionality without code changes:**
   ```typescript
   // In parent components, simply omit drag props
   <GanttBar
     task={task}
     x={x}
     y={y}
     width={width}
     height={height}
     isSelected={isSelected}
     onClick={onClick}
     // onTaskUpdate={handleTaskUpdate} // Comment out
     // pixelsPerDay={30}               // Comment out  
     // timelineStartDate={startDate}   // Comment out
   />
   ```

2. **Result**: GanttBar reverts to original click-only behavior

### Partial Rollback - Remove API Integration

1. **Modify GanttBar.tsx to keep visual feedback but disable API calls:**
   ```typescript
   // Comment out API integration in handleMouseUp
   // await onTaskUpdate(task.id, { startDate: newStartDate, endDate: newEndDate })
   // await updateIssue(task.id, { ... })
   
   console.log('Drag completed (API disabled):', { newStartDate, newEndDate })
   ```

### Full Rollback - Restore Original Component

1. **Backup current implementation:**
   ```bash
   cp /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web/src/components/gantt/GanttBar.tsx \
      /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/apps/web/src/components/gantt/GanttBar.tsx.drag-backup
   ```

2. **Restore from git:**
   ```bash
   cd /mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI
   git checkout HEAD~1 -- apps/web/src/components/gantt/GanttBar.tsx
   ```

3. **Or manually restore original component** (content from before drag implementation)

## Verification Steps

After each rollback level:

1. **Build Check:**
   ```bash
   npm run build
   ```

2. **Type Check:**
   ```bash
   npm run type-check
   ```

3. **Visual Verification:**
   - Open Gantt chart in browser
   - Verify tasks render correctly
   - Verify click functionality works
   - Confirm no drag cursors appear

4. **Performance Check:**
   - Monitor console for performance warnings
   - Verify smooth scrolling and zooming
   - Check memory usage stability

## Monitoring After Rollback

1. **Performance Metrics:**
   - Monitor render times return to baseline
   - Verify no memory leaks from event listeners
   - Check CPU usage during Gantt interactions

2. **User Feedback:**
   - Confirm drag functionality is fully disabled
   - Verify no broken interactions
   - Monitor for error reports

3. **API Monitoring:**
   - Check for reduced API error rates
   - Verify issue update operations work normally
   - Monitor for data consistency

## File Manifest

### Files Modified (for rollback reference):

**Modified:**
- `/apps/web/src/components/gantt/GanttBar.tsx` - Added drag functionality

**Created:**
- `/docs/implementation/T008_gantt_bar_drag_implementation.md` - Implementation docs
- `/docs/rollback-plan-T008-drag.md` - This rollback plan

### Original File Backup Commands:

```bash
# Create backup before rollback
git show HEAD~1:apps/web/src/components/gantt/GanttBar.tsx > GanttBar.original.tsx

# Compare changes
git diff HEAD~1 apps/web/src/components/gantt/GanttBar.tsx
```

## Communication Plan

### Internal Team
1. Announce rollback decision and level
2. Provide ETA for resolution
3. Share monitoring results post-rollback

### External Users
1. If user-facing issues: "Temporarily disabled advanced drag features for stability"
2. If no user impact: No communication needed

## Post-Rollback Actions

1. **Root Cause Analysis:**
   - Identify specific issue that triggered rollback
   - Document lessons learned
   - Plan improved implementation approach

2. **Re-implementation Planning:**
   - Address identified issues
   - Enhanced testing strategy
   - Staged rollout plan

3. **Monitoring Enhancement:**
   - Add more detailed performance metrics
   - Improve error detection
   - Better user feedback mechanisms

## Emergency Contacts

- **Development Lead**: [Contact info]
- **Operations Team**: [Contact info]  
- **Product Owner**: [Contact info]

---

**Document Version**: 1.0
**Last Updated**: 2025-01-06
**Created by**: Claude Code Assistant