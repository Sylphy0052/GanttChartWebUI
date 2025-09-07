# Rollback Plan: T018 AC1 - Forward Pass Implementation

## Overview
This rollback plan provides steps to revert the implementation of AC1: Forward pass calculates Early Start (ES) and Early Finish (EF) for all tasks in dependency graph.

## Changes Made

### 1. Modified Files
- `/apps/api/src/scheduling/scheduling.service.ts` - Integrated ForwardPass algorithm into CPM calculation
- `/apps/api/src/scheduling/dto/schedule-response.dto.ts` - Updated ConflictInfo interface
- `/apps/api/src/scheduling/entities/computed-schedule.entity.ts` - Updated conflicts structure
- `/apps/api/src/scheduling/algorithms/constraint-solver.ts` - Fixed ConflictInfo compatibility

### 2. New Files
- `/apps/api/test-forward-pass.js` - Test script for AC1 validation

## Rollback Steps

### Step 1: Revert SchedulingService Changes
```bash
# Restore the original calculateCPMSchedule method
git checkout HEAD~1 -- apps/api/src/scheduling/scheduling.service.ts
```

**Alternative manual rollback for `calculateCPMSchedule` method (lines 259-301):**
```typescript
private async calculateCPMSchedule(issues: any[], dependencies: any[], constraints: any) {
  // Implementation will be completed in algorithm implementation phase
  const forwardPass = new ForwardPass();
  const backwardPass = new BackwardPass();
  const dummyConstraints = {
    startDate: new Date(),
    workingDays: [1, 2, 3, 4, 5], // Mon-Fri
    workingHoursPerDay: 8,
    holidays: [],
    resourceConstraints: new Map(),
    mandatoryDates: new Map()
  };
  const constraintSolver = new ConstraintSolver(dummyConstraints);

  // Stub implementation
  return {
    schedule: this.createStubSchedule(issues),
    conflicts: []
  };
}
```

### Step 2: Revert ConflictInfo Interface Changes
```bash
# Restore original ConflictInfo interface
git checkout HEAD~1 -- apps/api/src/scheduling/dto/schedule-response.dto.ts
```

**Alternative manual rollback:**
```typescript
export class ConflictInfo {
  type: ConflictType;
  taskId: string;
  description: string;
  severity: ConflictSeverity;
}
```

### Step 3: Revert ComputedScheduleEntity Changes
```bash
# Restore original entity structure
git checkout HEAD~1 -- apps/api/src/scheduling/entities/computed-schedule.entity.ts
```

**Alternative manual rollback for conflicts field (lines 32-39):**
```typescript
conflicts: Array<{
  type: 'resource' | 'dependency' | 'constraint';
  taskId: string;
  description: string;
  severity: 'warning' | 'error';
}>;
```

### Step 4: Revert ConstraintSolver Changes
```bash
# Restore original constraint solver
git checkout HEAD~1 -- apps/api/src/scheduling/algorithms/constraint-solver.ts
```

### Step 5: Remove Test Files
```bash
rm apps/api/test-forward-pass.js
```

### Step 6: Verify Rollback
```bash
# Test compilation
npm run build

# Verify that stub implementation is restored
grep -A 10 "calculateCPMSchedule" apps/api/src/scheduling/scheduling.service.ts
```

## Rollback Verification

After rollback, verify that:

1. ✅ SchedulingService returns to stub implementation
2. ✅ ConflictInfo interface matches original structure  
3. ✅ ComputedScheduleEntity conflicts field uses original format
4. ✅ ConstraintSolver uses original ConflictInfo format
5. ✅ TypeScript compilation succeeds (ignoring unrelated TypeORM issues)
6. ✅ API endpoints still respond with placeholder data

## Impact Assessment

### Low Risk Changes
- ForwardPass algorithm implementation - self-contained, no external dependencies
- Test file addition - can be safely removed

### Medium Risk Changes  
- ConflictInfo interface updates - affects multiple files but backward compatible
- SchedulingService integration - replaces stub with actual implementation

### Dependencies
- No database schema changes required for rollback
- No API contract changes (responses maintain same structure)
- No breaking changes to existing functionality

## Recovery Time
- **Automatic rollback**: 2-3 minutes using git
- **Manual rollback**: 10-15 minutes with careful code replacement

## Testing After Rollback
```bash
# Test that stub implementation is working
curl -X POST http://localhost:3000/api/projects/{projectId}/schedule/calculate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"options":{"algorithm":"cpm"},"constraints":{}}'
```

Should return stub data with empty critical path and basic task schedules.

## Notes
- This rollback only affects AC1 implementation
- Forward/Backward Pass algorithm files remain intact for future use
- Database schema supports both old and new conflict formats
- No data migration required for rollback