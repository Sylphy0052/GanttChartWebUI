# T018: Advanced Scheduling Engine - Rollback Plan

## Overview

This document provides a comprehensive rollback strategy for the T018 Advanced Scheduling Engine implementation. The rollback plan ensures safe reversion to the previous state while maintaining system stability.

## Pre-Rollback State

### What Was Working Before (AC1)
- ✅ Forward pass algorithm calculating ES/EF times
- ✅ Basic CPM scheduling with critical path candidates
- ✅ Simple conflict detection
- ✅ Basic API endpoints for schedule calculation

### Current Implementation State (AC1-AC7)
- ✅ Complete CPM with forward and backward pass
- ✅ Enhanced conflict detection and resolution
- ✅ Incremental update optimization
- ✅ Advanced calendar integration
- ✅ Comprehensive API endpoints

## Rollback Strategy

### Level 1: Safe Rollback (Recommended)
**Scope**: Revert AC2-AC7 enhancements while keeping AC1 functionality
**Risk**: Low - Maintains basic scheduling functionality

#### Files to Rollback
```bash
# Revert main service to basic state
git checkout HEAD~1 -- apps/api/src/scheduling/scheduling.service.ts

# Revert enhanced DTOs to basic versions
git checkout HEAD~1 -- apps/api/src/scheduling/dto/schedule-response.dto.ts

# Revert controller to basic endpoints  
git checkout HEAD~1 -- apps/api/src/scheduling/scheduling.controller.ts
```

#### Rollback Steps
1. **Backup current implementation**:
   ```bash
   cp apps/api/src/scheduling/scheduling.service.ts apps/api/src/scheduling/scheduling.service.ts.backup
   cp apps/api/src/scheduling/dto/schedule-response.dto.ts apps/api/src/scheduling/dto/schedule-response.dto.ts.backup
   cp apps/api/src/scheduling/scheduling.controller.ts apps/api/src/scheduling/scheduling.controller.ts.backup
   ```

2. **Revert to basic scheduling.service.ts**:
   - Remove `calculateIncrementalUpdate()` method
   - Remove enhanced `calculateCPMSchedule()` with backward pass
   - Remove advanced conflict detection methods
   - Keep basic forward pass integration

3. **Revert enhanced DTOs**:
   - Remove AC2/AC3 fields from `TaskSchedule` (latestStart, latestFinish, freeFloat)
   - Remove `CriticalPathStats` and enhanced `ComputedSchedule`
   - Remove advanced conflict types and analysis classes

4. **Revert controller endpoints**:
   - Remove incremental update endpoint
   - Remove conflict analysis endpoints  
   - Remove calendar configuration endpoints
   - Keep basic calculate/apply/preview endpoints

#### Expected State After Level 1 Rollback
- ✅ Basic forward pass scheduling works
- ✅ Simple conflict detection operational
- ✅ Core API endpoints functional
- ❌ No backward pass or float calculations
- ❌ No incremental updates
- ❌ No advanced calendar integration

### Level 2: Complete Rollback (Emergency)
**Scope**: Revert all T018 changes including AC1
**Risk**: Medium - Removes all advanced scheduling features

#### Files to Rollback
```bash
# Revert all scheduling files to pre-T018 state
git checkout HEAD~5 -- apps/api/src/scheduling/
```

#### Rollback Steps
1. **Complete service reversion**:
   ```bash
   # Remove all advanced algorithms
   rm -rf apps/api/src/scheduling/algorithms/
   
   # Revert to stub scheduling service
   git checkout HEAD~5 -- apps/api/src/scheduling/scheduling.service.ts
   ```

2. **Database considerations**:
   ```bash
   # If any migrations were applied, revert them
   # npx prisma migrate down (if applicable)
   ```

#### Expected State After Level 2 Rollback
- ✅ Basic project management works
- ✅ Simple issue scheduling 
- ❌ No CPM algorithms
- ❌ No critical path analysis
- ❌ No advanced conflict detection

### Level 3: Feature Toggle (Graceful Degradation)
**Scope**: Keep implementation but disable advanced features via configuration
**Risk**: Very Low - Allows controlled feature rollback

#### Implementation
Add feature flags to disable specific components:

```typescript
// Environment configuration
const SCHEDULING_FEATURES = {
  BACKWARD_PASS_ENABLED: process.env.ENABLE_BACKWARD_PASS === 'true',
  INCREMENTAL_UPDATES_ENABLED: process.env.ENABLE_INCREMENTAL_UPDATES === 'true',
  ADVANCED_CONFLICTS_ENABLED: process.env.ENABLE_ADVANCED_CONFLICTS === 'true',
  CALENDAR_INTEGRATION_ENABLED: process.env.ENABLE_CALENDAR_INTEGRATION === 'true'
};

// In SchedulingService
private async calculateCPMSchedule(issues: any[], dependencies: any[], constraints: any) {
  // Always do forward pass
  const forwardPassResult = forwardPass.calculate(taskNodes, projectStartDate, calendarConfig);
  
  // Conditional backward pass (AC2)
  if (SCHEDULING_FEATURES.BACKWARD_PASS_ENABLED) {
    const backwardPassResult = backwardPass.calculate(forwardPassResult, projectDeadline);
    return this.convertCPMResultToSchedule(forwardPassResult, backwardPassResult, projectStartDate, forwardPass);
  } else {
    // Fallback to basic forward pass only
    return this.convertForwardPassResultToSchedule(forwardPassResult, projectStartDate, forwardPass);
  }
}
```

#### Feature Flag Configuration
```bash
# Disable all advanced features
export ENABLE_BACKWARD_PASS=false
export ENABLE_INCREMENTAL_UPDATES=false  
export ENABLE_ADVANCED_CONFLICTS=false
export ENABLE_CALENDAR_INTEGRATION=false

# Or enable selectively
export ENABLE_BACKWARD_PASS=true
export ENABLE_INCREMENTAL_UPDATES=false
export ENABLE_ADVANCED_CONFLICTS=true
export ENABLE_CALENDAR_INTEGRATION=true
```

## Rollback Testing

### Verification Steps
1. **Basic functionality test**:
   ```bash
   curl -X POST /api/projects/test-project/schedule/calculate \
     -H "Content-Type: application/json" \
     -d '{"options":{"algorithm":"cpm"},"constraints":{}}'
   ```

2. **Advanced features disabled test**:
   ```bash
   # This should return 404 or disabled message after rollback
   curl -X POST /api/projects/test-project/schedule/calculate/incremental
   ```

3. **Database integrity check**:
   ```bash
   # Verify no orphaned data from advanced features
   npx prisma db validate
   ```

## Risk Mitigation

### Data Preservation
- **ComputedSchedule entities**: Keep existing calculated schedules (don't delete)
- **Audit logs**: Preserve all scheduling operation logs
- **Project data**: No impact on core project/issue data

### API Compatibility
- **Breaking changes**: Advanced endpoints will return 404 after rollback
- **Backward compatibility**: Basic endpoints maintain same contract
- **Client impact**: Frontend should handle missing advanced features gracefully

### Performance Considerations
- **Rollback impact**: Basic algorithms are less performant but more stable
- **Memory usage**: Lower memory usage after removing advanced features
- **Calculation time**: Longer calculation times without incremental updates

## Emergency Contacts

### If Rollback Fails
1. **Database corruption**: Use backup restoration procedures
2. **Service failure**: Restart application with environment variables
3. **Client impact**: Communicate feature degradation to users

### Escalation Path
1. **Technical Lead**: Review rollback execution
2. **DevOps**: Verify infrastructure state
3. **Product Owner**: Communicate user impact
4. **QA**: Validate rolled-back functionality

## Post-Rollback Actions

### Immediate (0-2 hours)
- [ ] Verify basic scheduling functionality works
- [ ] Check API endpoint responses
- [ ] Monitor error rates and performance metrics
- [ ] Test critical user workflows

### Short-term (2-24 hours)  
- [ ] Full regression testing of scheduling features
- [ ] Performance baseline re-establishment
- [ ] User communication about feature changes
- [ ] Documentation updates

### Medium-term (1-7 days)
- [ ] Analysis of rollback necessity
- [ ] Planning for re-implementation if needed
- [ ] Process improvement for future deployments
- [ ] Post-mortem documentation

## Rollback Decision Matrix

| Scenario | Recommended Level | Reasoning |
|----------|------------------|-----------|
| API performance issues | Level 3 (Feature Toggle) | Gradual feature disabling |
| Calculation errors | Level 1 (Safe Rollback) | Keep basic functionality |
| Database corruption | Level 2 (Complete Rollback) | Full system recovery |
| Client breaking changes | Level 3 (Feature Toggle) | Controlled degradation |
| Security vulnerabilities | Level 1 or 2 | Based on vulnerability scope |

## Success Criteria for Rollback

### Level 1 Rollback Success
- ✅ Basic schedule calculation works (AC1 functionality)
- ✅ Simple conflict detection operational
- ✅ Core API endpoints responsive
- ✅ No increase in error rates
- ✅ Performance returns to baseline

### Level 2 Rollback Success
- ✅ Application starts without errors
- ✅ Basic project management functional
- ✅ No scheduling-related crashes
- ✅ Database integrity maintained

### Level 3 Rollback Success
- ✅ Feature flags properly disable advanced features
- ✅ No degradation of enabled features
- ✅ Graceful fallback behavior
- ✅ Monitoring shows expected metrics

This rollback plan ensures safe reversion of T018 Advanced Scheduling Engine implementation while maintaining system stability and user access to core functionality.