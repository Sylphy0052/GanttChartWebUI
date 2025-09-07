# T017 AC7: Sprint 3 Demo Scenarios & Complete Documentation

## Sprint 3 Demo Scenarios

This document provides comprehensive demo scenarios for all Sprint 3 features (T012-T016) and complete rollback procedures.

### 🎯 Demo Scenario Overview

**Duration**: 20-30 minutes  
**Audience**: Stakeholders, QA team, Product managers  
**Prerequisites**: 
- Development environment running
- Test project with 100+ tasks created
- Demo user accounts configured
- Performance monitoring enabled

---

## 📋 Demo Scenario 1: Password Protection & Token Management (T012 & T014)

### Objective
Demonstrate secure project access with JWT tokens, rate limiting, and automatic token refresh.

### Setup (2 minutes)
1. **Project Configuration**:
   ```bash
   # Create protected demo project
   curl -X POST http://localhost:3001/projects \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Demo Project - Protected",
       "description": "Sprint 3 demonstration project",
       "password": "demo2024",
       "isProtected": true
     }'
   ```

2. **User Accounts**:
   - Admin: `admin@demo.com` / `admin123`
   - Member: `user@demo.com` / `user123`
   - Viewer: `viewer@demo.com` / `viewer123`

### Demo Steps (8 minutes)

#### Step 1: Project Access Modal (2 minutes)
1. **Navigate to protected project**:
   - URL: `http://localhost:3000/projects/demo-protected`
   - **Expected**: Project Access Modal appears
   - **Show**: Clean, accessible UI with password field

2. **Invalid password attempt**:
   - Enter: `wrongpassword`
   - Click "アクセス" button
   - **Expected**: Error message appears
   - **Highlight**: User-friendly error handling

3. **Valid password access**:
   - Enter: `demo2024`
   - Click "アクセス" button
   - **Expected**: Modal closes, project loads
   - **Show**: Seamless transition to project view

#### Step 2: Token Management (3 minutes)
1. **Token Storage Verification**:
   - Open browser DevTools → Application → Local Storage
   - **Show**: `project_access_tokens` entry with encrypted token
   - **Explain**: 24-hour token expiration with refresh capability

2. **Background Token Refresh**:
   - Simulate token near expiration (modify timestamp in localStorage)
   - Perform any project action (click, drag)
   - **Expected**: Automatic token refresh in background
   - **Show**: No user interruption

3. **Token Expiration Handling**:
   - Clear localStorage to simulate expired token
   - Try to update task progress
   - **Expected**: Re-authentication prompt appears
   - **Show**: Graceful session recovery

#### Step 3: Rate Limiting Protection (2 minutes)
1. **Demonstrate rate limiting**:
   ```bash
   # Simulate rapid login attempts
   for i in {1..10}; do
     curl -X POST http://localhost:3001/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email": "admin@demo.com", "password": "wrongpass"}' &
   done
   ```
   - **Expected**: Rate limiting kicks in after 5 attempts
   - **Show**: "Too many attempts" message with countdown

#### Step 4: Admin Override (1 minute)
1. **Admin bypass demonstration**:
   - Login as admin user
   - Navigate to any protected project
   - **Expected**: Direct access without password prompt
   - **Explain**: Role-based access control

### Key Points to Highlight
- ✅ Secure JWT-based authentication
- ✅ Automatic token refresh prevents interruptions  
- ✅ Rate limiting prevents brute force attacks
- ✅ Role-based access with admin override
- ✅ Graceful error handling and recovery
- ✅ 24-hour token persistence

---

## 📊 Demo Scenario 2: Progress Management & Leaf Task Validation (T013 & T015)

### Objective
Demonstrate advanced progress management with leaf-task-only updates and comprehensive validation.

### Setup (3 minutes)
1. **Load project with hierarchical tasks**:
   - Use pre-created project with 50+ tasks
   - Ensure mix of parent and leaf tasks
   - Some tasks at 0%, 50%, and 100% progress

2. **Open Progress Management UI**:
   - Navigate to project dashboard
   - **Show**: Task hierarchy with progress indicators

### Demo Steps (10 minutes)

#### Step 1: Leaf Task Progress Updates (3 minutes)
1. **Identify leaf tasks**:
   - **Show**: Visual distinction between parent and leaf tasks
   - **Highlight**: Only leaf tasks have editable progress controls
   - Parent tasks show calculated progress (read-only)

2. **Single task progress update**:
   - Select a leaf task at 25% progress
   - Update to 75% using progress input
   - Press Enter to save
   - **Expected**: 
     - Progress bar updates immediately
     - Activity log entry created
     - Parent task progress recalculated automatically

3. **Progress validation**:
   - Try entering 150% (invalid)
   - **Expected**: Validation error message
   - Try entering -10% (invalid)
   - **Expected**: Range validation prevents save
   - **Show**: Real-time validation feedback

#### Step 2: Parent Task Protection (2 minutes)
1. **Attempt parent task update**:
   - Click on a parent task progress field
   - Try to edit directly
   - **Expected**: 
     - Field remains disabled/read-only
     - Tooltip explains why editing is disabled
     - "Cannot update parent task progress" message

2. **Show calculated progress**:
   - **Explain**: Parent progress = average of child progress
   - Update child task progress
   - **Show**: Parent progress updates automatically
   - **Highlight**: Real-time hierarchy recalculation

#### Step 3: Batch Progress Updates (3 minutes)
1. **Select multiple leaf tasks**:
   - Use checkboxes to select 5-7 leaf tasks
   - Click "一括更新" (Batch Update) button
   - **Expected**: Batch Progress Update Modal opens

2. **Batch update execution**:
   - Set progress to 80%
   - Add comment: "Sprint 3 milestone completed"
   - Click "一括更新実行" button
   - **Expected**:
     - Progress indicator shows update status
     - Success message with count "7件のタスクが更新されました"
     - All selected tasks updated to 80%

3. **Batch update with partial failures**:
   - Include one parent task in selection (simulate error)
   - Attempt batch update
   - **Expected**:
     - Partial success message: "6件成功、1件失敗"
     - Failed task details shown
     - "失敗したタスクを再試行" option available

#### Step 4: Activity Logging (2 minutes)
1. **View activity log**:
   - Navigate to project activity panel
   - **Show**: All progress updates logged with:
     - Timestamp
     - User attribution
     - Before/after values
     - Comments
     - Batch operation grouping

2. **Activity detail inspection**:
   - Click on activity entry
   - **Show**: Detailed change information
   - **Highlight**: Audit trail for compliance

### Key Points to Highlight
- ✅ Leaf-task-only progress updates prevent data corruption
- ✅ Real-time validation with helpful error messages
- ✅ Automatic parent task progress calculation
- ✅ Efficient batch operations for productivity
- ✅ Comprehensive activity logging for audit
- ✅ Optimistic updates with conflict resolution

---

## 📈 Demo Scenario 3: Advanced KPI Measurement & Performance Telemetry (T016)

### Objective
Demonstrate comprehensive performance monitoring, KPI measurement, and real-time optimization recommendations.

### Setup (2 minutes)
1. **Enable performance monitoring**:
   ```bash
   # Set telemetry configuration
   export ENABLE_TELEMETRY=true
   export TELEMETRY_BATCH_SIZE=100
   export TELEMETRY_FLUSH_INTERVAL=5000
   ```

2. **Load large dataset**:
   - Use project with 200+ tasks for performance testing
   - Multiple dependencies and hierarchical structure

### Demo Steps (12 minutes)

#### Step 1: Real-Time Performance Monitoring (4 minutes)
1. **Initial render measurement**:
   - Navigate to large project
   - **Show**: Performance metrics in browser DevTools
   - **Highlight**: Initial render time < 1.5 seconds (target met)

2. **Interaction performance tracking**:
   - Perform drag operation on task
   - **Show**: Drag response time measurement
   - Zoom in/out on timeline
   - **Show**: Zoom transition time tracking
   - **Expected**: All operations < 200ms response time

3. **Memory usage monitoring**:
   - Open Performance Dashboard
   - **Show**: Memory usage graphs
   - Perform multiple operations
   - **Expected**: Memory usage stays within 512MB limit

4. **Performance thresholds validation**:
   - **Show**: Green indicators for all performance metrics
   - **Explain**: Automatic alerting when thresholds exceeded

#### Step 2: KPI Dashboard (3 minutes)
1. **Navigate to KPI Dashboard**:
   - URL: `http://localhost:3000/analytics/performance`
   - **Show**: Comprehensive performance overview

2. **Key metrics display**:
   - **Render Performance**: Average render time across sessions
   - **User Interactions**: Total clicks, drags, zooms per session
   - **System Health**: Error rates, response times, uptime
   - **Resource Usage**: Memory, CPU, network consumption

3. **Trend analysis**:
   - **Show**: Performance trends over time
   - **Highlight**: Performance improvements since Sprint 2
   - **Explain**: Data-driven optimization decisions

#### Step 3: Telemetry Data Collection (2 minutes)
1. **Background data collection**:
   - Perform various user actions (drag, zoom, progress updates)
   - **Show**: Telemetry data being collected in background
   - **Highlight**: No performance impact on user experience

2. **Data batching and processing**:
   - Open Network tab in DevTools
   - **Show**: Batched telemetry uploads every 5 seconds
   - **Explain**: Efficient data collection minimizes API calls

#### Step 4: AI-Powered Recommendations (3 minutes)
1. **Performance analysis**:
   - Navigate to Recommendations panel
   - **Show**: AI-generated performance recommendations:
     ```
     🚨 High Impact Recommendation
     Title: Optimize Rendering Performance
     Description: Render times consistently above 100ms
     Impact: 25% improvement in user satisfaction expected
     Effort: Medium
     Confidence: 85%
     Evidence: Average render time 150ms across 1000+ sessions
     ```

2. **Optimization suggestions**:
   - **Show**: Specific technical recommendations
   - Virtualized rendering for large datasets
   - Component memoization opportunities
   - Bundle size optimization suggestions

3. **Business impact metrics**:
   - **Show**: Performance correlation with user engagement
   - Task completion rate vs. response time analysis
   - User retention correlation with performance

### Key Points to Highlight
- ✅ Comprehensive performance monitoring without user impact
- ✅ Real-time KPI tracking and alerting
- ✅ AI-powered optimization recommendations
- ✅ Business impact correlation analysis  
- ✅ Efficient background data collection
- ✅ Performance-driven feature development

---

## 🔄 Demo Scenario 4: End-to-End Integration Validation

### Objective
Demonstrate all Sprint 3 features working together seamlessly under realistic conditions.

### Setup (2 minutes)
1. **Multi-user simulation**:
   - Open 3 browser tabs with different user roles
   - Large project with 100+ tasks loaded
   - Real-time collaboration enabled

### Demo Steps (8 minutes)

#### Step 1: Concurrent User Operations (3 minutes)
1. **User A (Admin)**: Batch update 10 tasks to 90%
2. **User B (Member)**: Update individual task progress
3. **User C (Viewer)**: View project and activity log
4. **Expected**:
   - All operations complete successfully
   - Real-time updates visible to all users
   - Activity log shows all changes with proper attribution
   - No conflicts or data inconsistencies

#### Step 2: Performance Under Load (2 minutes)
1. **Simulate high load**:
   - All users perform rapid interactions (drag, zoom, update)
   - Monitor performance metrics
   - **Expected**:
     - Response times remain < 200ms
     - Memory usage stable
     - No UI freezing or lag
     - Error rate < 0.1%

#### Step 3: Error Recovery (1.5 minutes)
1. **Network interruption simulation**:
   - Disconnect network during progress update
   - **Show**: Offline mode indicator
   - **Show**: Queued operations
   - Reconnect network
   - **Expected**: Automatic retry and sync

#### Step 4: Cross-Feature Validation (1.5 minutes)
1. **Authentication + Progress + Telemetry**:
   - Token refresh during active operation
   - Progress update with background telemetry
   - **Expected**: Seamless operation without interruption
   - All systems continue working together

### Key Points to Highlight
- ✅ Seamless multi-feature integration
- ✅ Performance maintained under concurrent load
- ✅ Robust error recovery mechanisms
- ✅ Real-time collaboration without conflicts
- ✅ Comprehensive monitoring across all features

---

## 🔒 Rollback Procedures

### Emergency Rollback (< 5 minutes)

#### Immediate Actions
1. **Stop all services**:
   ```bash
   # API rollback
   cd apps/api
   git checkout HEAD~1  # Previous commit
   npm run build
   npm run start

   # Web rollback
   cd apps/web  
   git checkout HEAD~1  # Previous commit
   npm run build
   npm run start
   ```

2. **Database rollback**:
   ```bash
   # Revert latest migration
   cd apps/api
   npm run prisma:migrate:reset
   # Restore from backup if needed
   ```

3. **Verify system stability**:
   - Basic functionality test
   - Performance check
   - User access verification

#### Communication
```
🚨 ROLLBACK EXECUTED - Sprint 3 Features Temporarily Disabled
- All Sprint 3 features (T012-T016) have been rolled back
- System restored to Sprint 2 stable state  
- Users can continue with core functionality
- ETA for resolution: [X hours]
- Status updates: [communication channel]
```

### Feature-Specific Rollbacks

#### T012: Password Protection Rollback
```bash
# Disable password protection
export DISABLE_PROJECT_AUTH=true

# Remove authentication middleware
git revert [T012-commits]

# Database: Remove password fields
npx prisma db push --force-reset
```

#### T013: Progress Update API Rollback
```bash
# Revert to basic progress updates
git revert [T013-commits]

# Remove activity logging
DROP TABLE ActivityLog;

# Remove progress validation
# (handled by git revert)
```

#### T014: Project Access Modal Rollback
```bash
# Remove modal components
rm -rf src/components/ui/ProjectAccessModal.tsx
git checkout HEAD~1 -- src/components/ui/

# Disable token management
export DISABLE_TOKEN_MANAGEMENT=true
```

#### T015: Progress Management UI Rollback
```bash
# Revert to simple progress inputs
git revert [T015-commits]

# Remove batch operations
rm -rf src/components/gantt/BatchProgressUpdateModal.tsx

# Remove leaf-task validation UI
git checkout HEAD~1 -- src/components/gantt/ProgressManagementSystem.tsx
```

#### T016: Advanced KPI Measurement Rollback
```bash
# Disable telemetry collection
export DISABLE_TELEMETRY=true

# Remove telemetry endpoints
git revert [T016-commits]

# Remove performance monitoring
rm -rf src/lib/advanced-telemetry.ts
rm -rf apps/api/src/telemetry/
```

### Gradual Feature Restoration

#### Phase 1: Core Functionality (30 minutes)
1. **Restore authentication** (T012):
   - Re-enable password protection
   - Test login flow
   - Verify token generation

2. **Restore progress updates** (T013):
   - Re-enable leaf-task validation
   - Test basic progress updates
   - Verify activity logging

#### Phase 2: UI Components (45 minutes)
1. **Restore modals** (T014):
   - Re-enable project access modal
   - Test token management
   - Verify background refresh

2. **Restore progress management** (T015):
   - Re-enable batch operations
   - Test progress validation UI
   - Verify leaf-task restrictions

#### Phase 3: Advanced Features (60 minutes)
1. **Restore telemetry** (T016):
   - Re-enable performance monitoring
   - Test KPI collection
   - Verify analytics dashboard

2. **Integration testing**:
   - Cross-feature validation
   - Performance verification
   - User acceptance testing

### Rollback Decision Matrix

| Issue Severity | Response Time | Action |
|---------------|---------------|---------|
| **Critical**: System down, data loss | < 5 minutes | Emergency full rollback |
| **High**: Feature broken, users blocked | < 15 minutes | Feature-specific rollback |
| **Medium**: Performance degraded | < 30 minutes | Gradual rollback + fix |
| **Low**: Minor UI issues | < 60 minutes | Fix forward |

### Post-Rollback Analysis

#### Mandatory Steps
1. **Root cause analysis**:
   - Technical failure investigation
   - Process failure identification
   - Timeline reconstruction

2. **Prevention measures**:
   - Additional testing requirements
   - Monitoring improvements
   - Process updates

3. **Recovery planning**:
   - Feature restoration timeline
   - Risk mitigation strategies
   - Communication plan

#### Documentation Updates
- Update rollback procedures based on experience
- Document lessons learned
- Improve testing strategies
- Enhance monitoring coverage

---

## 🎯 Demo Success Criteria

### Technical Validation
- ✅ All Sprint 3 features demonstrate successfully
- ✅ Performance targets met (< 1.5s render, < 200ms interactions)
- ✅ Error scenarios handled gracefully
- ✅ Cross-browser compatibility verified
- ✅ Mobile responsiveness confirmed
- ✅ Accessibility compliance validated

### Business Validation  
- ✅ User workflow improvements demonstrated
- ✅ Security enhancements validated
- ✅ Performance improvements quantified
- ✅ Scalability with 1000+ tasks confirmed
- ✅ Rollback procedures tested and documented

### Stakeholder Approval
- ✅ Product owner acceptance
- ✅ Technical lead approval
- ✅ QA team sign-off
- ✅ Security team clearance
- ✅ Performance team validation

---

## 📞 Emergency Contacts

**During Demo Hours (9 AM - 6 PM JST)**:
- Tech Lead: [contact-info]
- DevOps: [contact-info]  
- Product Owner: [contact-info]

**24/7 Emergency**:
- On-call Engineer: [contact-info]
- Incident Response: [contact-info]

**Rollback Authority**:
- Primary: Tech Lead
- Secondary: Senior Developer
- Final Authority: Engineering Manager

---

*Last Updated: 2024-09-06*  
*Next Review: Sprint 4 Planning*