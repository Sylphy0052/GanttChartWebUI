# T010 Auto-Scheduling Implementation - Rollback Plan

## Overview

This document provides a rollback strategy for the T010 Auto-Scheduling implementation (AC4 & AC5). The auto-scheduling feature introduces complex dependency management and composite command operations that require careful rollback procedures.

## Implementation Summary

### Files Added
- `/src/lib/scheduling/dependencyScheduler.ts` - Core scheduling algorithm
- `/src/lib/commands/AutoSchedulingCommand.ts` - Composite command for auto-scheduling
- `/src/hooks/useAutoScheduling.tsx` - React hook for scheduling integration
- `/src/components/gantt/AutoSchedulingDemo.tsx` - Demo component
- `/src/lib/commands/__tests__/AutoSchedulingCommand.test.ts` - Test suite

### Files Modified
- `/src/lib/commands/BaseCommand.ts` - Added 'auto-scheduling' command type
- `/src/lib/commands/BaseCommand.ts` - Added factory method for AutoSchedulingCommand

### Dependencies Introduced
- Enhanced command pattern with composite operations
- Dependency scheduling algorithm with cascading logic
- Complex undo/redo operations for multi-task changes

## Rollback Scenarios

### Scenario 1: Immediate Rollback (Safe)
**Situation:** Implementation just deployed, no users have interacted with auto-scheduling features.

**Steps:**
1. **Feature Toggle Disable:**
   ```typescript
   // In useAutoScheduling.tsx
   const DEFAULT_CONFIG: AutoSchedulingConfig = {
     enabled: false, // Disable auto-scheduling
     // ... other config
   }
   ```

2. **Remove New Files:**
   ```bash
   git rm src/lib/scheduling/dependencyScheduler.ts
   git rm src/lib/commands/AutoSchedulingCommand.ts
   git rm src/hooks/useAutoScheduling.tsx
   git rm src/components/gantt/AutoSchedulingDemo.tsx
   git rm src/lib/commands/__tests__/AutoSchedulingCommand.test.ts
   ```

3. **Revert BaseCommand Changes:**
   ```typescript
   // Remove 'auto-scheduling' from command types
   type: 'bar-move' | 'bar-resize' | 'progress-update' | 'dependency-create' | 'dependency-delete' | 'issue-edit' | 'composite'
   
   // Remove factory method
   // static createAutoSchedulingCommand = ...
   ```

**Risk Level:** ⭐ LOW  
**Downtime:** < 5 minutes  
**Data Loss:** None

### Scenario 2: Graceful Rollback (Users Active)
**Situation:** Users have been using the system, some auto-scheduling operations in history.

**Steps:**
1. **Disable New Features First:**
   ```typescript
   // Emergency config override
   export const EMERGENCY_AUTO_SCHEDULING_DISABLED = true
   
   // In useAutoScheduling.tsx
   if (EMERGENCY_AUTO_SCHEDULING_DISABLED) {
     return {
       executeBarMoveWithScheduling: executeRegularBarMove,
       executeBarResizeWithScheduling: executeRegularBarResize,
       // ... fallback implementations
     }
   }
   ```

2. **Clear Auto-Scheduling History:**
   ```typescript
   // Clear any auto-scheduling commands from undo history
   const { clearHistory } = useUndoRedo()
   clearHistory() // Nuclear option - clears all history
   
   // Or selective cleanup:
   // Filter out auto-scheduling commands from history
   ```

3. **Graceful Degradation:**
   ```typescript
   // Fallback to regular operations
   const executeBarMoveWithoutScheduling = async (params) => {
     const regularCommand = new BarMoveCommand(params)
     await executeCommand(regularCommand)
   }
   ```

**Risk Level:** ⭐⭐ MEDIUM  
**Downtime:** 10-15 minutes  
**Data Loss:** Command history only

### Scenario 3: Emergency Rollback (Critical Issue)
**Situation:** Auto-scheduling causing data corruption, infinite loops, or system crashes.

**Steps:**
1. **Immediate Circuit Breaker:**
   ```typescript
   // Emergency kill switch
   export const KILL_SWITCH_AUTO_SCHEDULING = true
   
   // In all auto-scheduling entry points
   if (KILL_SWITCH_AUTO_SCHEDULING) {
     throw new Error('Auto-scheduling disabled due to emergency')
   }
   ```

2. **Database Rollback (if needed):**
   ```sql
   -- If auto-scheduling corrupted task dates
   BEGIN TRANSACTION;
   
   -- Restore from backup or revert problematic updates
   UPDATE issues SET 
     start_date = backup_start_date,
     end_date = backup_end_date
   WHERE updated_at > 'DEPLOYMENT_TIMESTAMP'
     AND updated_by_auto_scheduler = true;
   
   COMMIT;
   ```

3. **Code Revert:**
   ```bash
   git revert <auto-scheduling-commits>
   git push --force-with-lease origin main
   ```

**Risk Level:** ⭐⭐⭐ HIGH  
**Downtime:** 30-60 minutes  
**Data Loss:** Possible task date corruption

## Rollback Verification

### Pre-Rollback Checklist
- [ ] Identify affected users and notify them
- [ ] Take database backup of task/dependency data
- [ ] Document current system state
- [ ] Prepare rollback scripts and commands
- [ ] Coordinate with team members

### Post-Rollback Verification
1. **Functional Tests:**
   - [ ] Basic bar move/resize operations work without auto-scheduling
   - [ ] Undo/redo works for regular operations
   - [ ] Dependencies still display correctly
   - [ ] No JavaScript console errors

2. **Data Integrity:**
   - [ ] Task dates are consistent and valid
   - [ ] Dependencies are preserved
   - [ ] No orphaned scheduling commands in history

3. **Performance:**
   - [ ] Operation response times back to baseline
   - [ ] No memory leaks from scheduling algorithms
   - [ ] UI remains responsive

### Success Criteria
- ✅ All Gantt operations function normally
- ✅ No auto-scheduling code executes
- ✅ User data is intact and consistent
- ✅ System performance is stable
- ✅ No error logs related to auto-scheduling

## Prevention Measures

### Future Implementation Guidelines
1. **Feature Flags:** Always implement complex features behind toggles
2. **Progressive Rollout:** Test with limited users first
3. **Circuit Breakers:** Build in emergency disable mechanisms
4. **Data Validation:** Extensive validation for scheduling results
5. **Comprehensive Testing:** Cover edge cases and failure modes

### Monitoring & Alerts
- **Performance Degradation:** Response time > 500ms for scheduling operations
- **High Error Rates:** > 5% failure rate for auto-scheduling commands
- **Memory Usage:** Unusual memory consumption patterns
- **Database Load:** Excessive task update operations

## Contact Information

**Primary Contact:** Development Team  
**Escalation:** Technical Lead  
**Emergency Contact:** On-call Engineer  

## Appendix: Safe Mode Implementation

### Minimal Auto-Scheduling Stub
```typescript
// Emergency fallback implementation
export const useAutoSchedulingSafeMode = () => ({
  executeBarMoveWithScheduling: async (params) => {
    // Just execute primary command, no scheduling
    const command = new BarMoveCommand(params)
    await executeCommand(command)
  },
  executeBarResizeWithScheduling: async (params) => {
    // Just execute primary command, no scheduling
    const command = new BarResizeCommand(params)
    await executeCommand(command)
  },
  isAutoSchedulingAvailable: () => false,
  analyzeSchedulingImpact: () => Promise.resolve({
    willTriggerScheduling: false,
    estimatedAffectedTasks: 0,
    maxCascadingLevels: 0,
    hasCircularDependencies: false,
    estimatedExecutionTime: 0,
    recommendedAction: 'proceed' as const
  }),
  config: { enabled: false },
  updateConfig: () => {},
  isProcessing: false,
  lastSchedulingResult: null
})
```

### Emergency Configuration Override
```typescript
// Add to environment variables or config
EMERGENCY_DISABLE_AUTO_SCHEDULING=true
MAX_AUTO_SCHEDULING_TASKS=0
AUTO_SCHEDULING_TIMEOUT_MS=100
FORCE_SAFE_MODE=true
```

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-06  
**Review Date:** 2024-01-20