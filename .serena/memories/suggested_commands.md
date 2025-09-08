# Suggested Commands - GanttChart WebUI

## Docker Development (Recommended)

### Initial Setup
```bash
# Clone and setup environment
cp .env.example .env
cd infra
docker compose up -d
```

### Daily Development
```bash
# Start all services
cd infra && docker compose up -d

# Check logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# Stop services
docker compose down

# Reset database (nuclear option)
docker compose down -v
docker compose up -d
```

### Access Points
- Application: http://localhost:8080 (nginx proxy)
- Frontend: http://localhost:3000 (direct)
- Backend API: http://localhost:3001 (direct)

## Local Development

### Backend Commands (in /backend)
```bash
# Setup
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:dev

# Development
npm run start:dev          # Hot reload server (port 3001)
npm run build              # Production build
npm run start:prod         # Production server

# Database
npm run prisma:studio      # Database GUI (port 5555)
npm run prisma:generate    # Regenerate Prisma client
npm run prisma:migrate:dev # Run migrations

# Testing & Quality
npm run test               # Unit tests
npm run test:e2e          # E2E tests
npm run test:cov          # Coverage report
npm run lint              # ESLint
npm run format            # Prettier formatting

# Custom Test Scripts
npm run test:db           # Database connection test
npm run test:prisma       # Prisma generation test
```

### Frontend Commands (in /frontend)
```bash
# Setup
npm install

# Development
npm run dev               # Development server (port 3000)
npm run build             # Production build
npm run start             # Production server

# Testing & Quality
npm run lint              # ESLint check
npm run cypress:open      # Cypress GUI
npm run cypress:run       # Cypress headless
npm run test:e2e          # E2E test suite
```

## Database Management
```bash
# Prisma Studio (Database GUI)
cd backend && npm run prisma:studio

# Apply migrations
cd backend && npm run prisma:migrate:dev

# Reset database
cd backend && npm run prisma:migrate:reset

# Generate client after schema changes
cd backend && npm run prisma:generate
```

## System Utilities (Linux/WSL)
```bash
# Process management
ps aux | grep node        # Find running processes
netstat -tulpn | grep :3  # Check port usage
kill -9 <pid>            # Kill process

# File operations
find . -name "*.ts" -type f    # Find TypeScript files
grep -r "searchterm" src/      # Search in source
ls -la                         # List with permissions
```

## Git Workflow
```bash
git status                # Check changes
git add .                 # Stage changes
git commit -m "message"   # Commit
git push origin develop   # Push to develop branch
```

## Common Development Tasks

### After pulling changes:
```bash
cd backend && npm install && npm run prisma:generate
cd frontend && npm install
```

### Before committing:
```bash
cd backend && npm run lint && npm run test
cd frontend && npm run lint
```

### Full system check:
```bash
cd backend && npm run build && npm run test:e2e
cd frontend && npm run build
```