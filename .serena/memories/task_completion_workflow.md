# Task Completion Workflow - GanttChart WebUI

## MANDATORY Steps After Task Completion

### 1. Code Quality Checks (REQUIRED)

#### Backend Quality Checks
```bash
cd backend

# TypeScript compilation check
npm run build

# Linting (must pass)
npm run lint

# Code formatting
npm run format

# Unit tests (if applicable)
npm run test

# E2E tests (for critical changes)
npm run test:e2e
```

#### Frontend Quality Checks
```bash
cd frontend

# TypeScript compilation check
npm run build

# Linting (must pass)  
npm run lint

# E2E tests (for UI changes)
npm run cypress:run
```

### 2. Database Integrity (if schema changes)
```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Apply migrations
npm run prisma:migrate:dev

# Verify database connection
npm run test:db
```

### 3. Integration Testing
```bash
# Start both services in development
cd backend && npm run start:dev &
cd frontend && npm run dev &

# Test critical user flows manually:
# - Authentication
# - CRUD operations affected by changes
# - Any new features

# Kill background processes after testing
```

### 4. Git Workflow
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: implement feature X with Y functionality"

# Push to development branch
git push origin develop
```

## Task Types & Specific Requirements

### New Feature Implementation
- [ ] Backend API endpoints implemented
- [ ] Frontend UI components created
- [ ] Database schema updated (if needed)
- [ ] Authentication/authorization implemented
- [ ] Input validation added
- [ ] Error handling implemented
- [ ] Unit tests written
- [ ] E2E tests updated
- [ ] Documentation updated

### Bug Fix
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Regression test added
- [ ] Related areas tested
- [ ] Edge cases verified

### Refactoring
- [ ] Functionality preserved
- [ ] Performance impact measured
- [ ] Dependencies updated correctly
- [ ] All tests pass
- [ ] No breaking changes introduced

### Database Changes
- [ ] Migration script created
- [ ] Schema validation passed
- [ ] Data integrity verified
- [ ] Rollback plan documented
- [ ] Production migration tested

## Pre-Commit Checklist

### General
- [ ] Code compiles without errors
- [ ] All linting rules pass
- [ ] No console.log statements left behind
- [ ] No unused imports/variables
- [ ] Environment variables properly configured
- [ ] Error messages are user-friendly

### Security
- [ ] No hardcoded credentials
- [ ] Input validation implemented
- [ ] Authentication/authorization working
- [ ] No sensitive data in logs

### Performance
- [ ] Database queries optimized
- [ ] No N+1 query problems
- [ ] Image assets optimized
- [ ] Unnecessary re-renders avoided

## Testing Strategy

### Unit Tests (Backend)
```bash
# Test individual services
npm run test src/features/feature.service.spec.ts

# Test with coverage
npm run test:cov
```

### Integration Tests (E2E)
```bash
# Backend E2E tests
npm run test:e2e

# Frontend E2E tests
cd frontend && npm run cypress:run
```

### Manual Testing Checklist
- [ ] Happy path works correctly
- [ ] Error scenarios handled gracefully
- [ ] Loading states displayed properly
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility checked

## Deployment Readiness

### Before Production Deploy
- [ ] All tests pass in CI/CD
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Backup plan in place
- [ ] Monitoring setup verified
- [ ] Performance benchmarks met

### Post-Deployment
- [ ] Health check endpoints respond
- [ ] Critical user flows tested in production
- [ ] Error rates monitored
- [ ] Performance metrics reviewed
- [ ] User feedback collected

## Common Issues & Solutions

### TypeScript Errors
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules && npm install

# Regenerate Prisma client
npm run prisma:generate
```

### Database Issues
```bash
# Reset database completely
npm run prisma:migrate:reset

# Apply specific migration
npm run prisma:migrate:deploy
```

### Port Conflicts
```bash
# Find processes using ports
netstat -tulpn | grep :3001
kill -9 <process_id>
```

## Documentation Updates
After significant changes, update:
- [ ] README.md
- [ ] API documentation
- [ ] Component documentation
- [ ] Deployment guides
- [ ] User guides (if UI changes)