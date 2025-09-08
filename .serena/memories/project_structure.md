# Project Structure - GanttChart WebUI

## Root Directory Structure
```
GanttChartWebUI/
├── .claude/                 # Claude AI configuration
├── .serena/                # Serena agent configuration
├── backend/                # NestJS backend application
├── frontend/               # Next.js frontend application
├── infra/                  # Docker & infrastructure setup
├── docs/                   # Project documentation
├── scripts/                # Build/deployment scripts
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore patterns
├── README.md             # Project overview
└── CLAUDE.md             # Claude AI development guidelines
```

## Backend Structure (/backend)
```
backend/
├── src/
│   ├── app.module.ts           # Root application module
│   ├── main.ts                 # Application entry point
│   ├── auth/                   # Authentication & authorization
│   │   ├── guards/             # Auth guards (Basic, Role)
│   │   └── decorators/         # Custom decorators
│   ├── backup/                 # Project backup/export
│   │   ├── backup.controller.ts
│   │   ├── backup.service.ts
│   │   └── dto/
│   ├── changelog/              # Change tracking
│   │   ├── changelog.service.ts
│   │   └── dto/
│   ├── comments/               # Issue comments
│   │   ├── comments.controller.ts
│   │   ├── comments.service.ts
│   │   └── dto/
│   ├── common/                 # Shared utilities
│   │   ├── filters/           # Exception filters
│   │   ├── interceptors/      # Response interceptors
│   │   └── utils/             # Helper functions
│   ├── database/               # Database configuration
│   │   └── prisma.service.ts
│   ├── health/                 # Health check endpoint
│   │   └── health.controller.ts
│   ├── issues/                 # Issue management
│   │   ├── issues.controller.ts
│   │   ├── issues.service.ts
│   │   └── dto/
│   ├── projects/               # Project management
│   │   ├── projects.controller.ts
│   │   ├── projects.service.ts
│   │   └── dto/
│   ├── settings/               # Global settings
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   └── dto/
│   └── websocket/              # Real-time notifications
│       ├── websocket.gateway.ts
│       └── websocket.module.ts
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
├── test/                       # E2E tests
│   ├── test-setup.ts          # Test configuration
│   ├── auth.e2e-spec.ts       # Authentication tests
│   ├── projects.e2e-spec.ts   # Project CRUD tests
│   ├── backup.e2e-spec.ts     # Backup functionality tests
│   └── test-suite.e2e-spec.ts # Comprehensive test suite
├── uploads/                    # File upload storage
├── package.json               # Dependencies & scripts
├── tsconfig.json             # TypeScript configuration
└── nest-cli.json             # NestJS CLI configuration
```

## Frontend Structure (/frontend)
```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   ├── globals.css        # Global styles
│   │   └── projects/          # Projects section
│   │       ├── page.tsx       # Projects list
│   │       └── [id]/          # Dynamic project routes
│   │           ├── layout.tsx
│   │           ├── page.tsx   # Project detail
│   │           └── issues/    # Issues subsection
│   ├── components/            # Reusable components
│   │   ├── ui/               # Basic UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── projects/         # Project-specific components
│   │   │   ├── ProjectList.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectCard.tsx
│   │   ├── issues/           # Issue-specific components
│   │   │   ├── IssueList.tsx
│   │   │   ├── IssueForm.tsx
│   │   │   ├── IssueDetail.tsx
│   │   │   └── IssueCard.tsx
│   │   ├── uploads/          # File upload components
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── ImageGallery.tsx
│   │   │   └── ImagePreview.tsx
│   │   └── layout/           # Layout components
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── lib/                   # Utility libraries
│   │   ├── api.ts            # API client functions
│   │   ├── auth.ts           # Authentication utilities
│   │   ├── utils.ts          # General utilities
│   │   └── websocket.ts      # WebSocket client
│   └── types/                 # TypeScript type definitions
│       ├── project.ts        # Project-related types
│       ├── issue.ts          # Issue-related types
│       ├── upload.ts         # Upload-related types
│       └── auth.ts           # Authentication types
├── public/                    # Static assets
│   ├── favicon.ico
│   └── images/
├── cypress/                   # E2E tests
│   ├── e2e/                  # Test specifications
│   ├── fixtures/             # Test data
│   └── support/              # Test utilities
├── package.json              # Dependencies & scripts
├── next.config.ts           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── cypress.config.ts        # Cypress configuration
```

## Infrastructure Structure (/infra)
```
infra/
├── docker-compose.yml        # Multi-container setup
├── .env                     # Environment variables
├── Dockerfile.backend       # Backend container
├── Dockerfile.frontend      # Frontend container
└── nginx.conf               # Nginx reverse proxy config
```

## Key File Purposes

### Backend Key Files
- `app.module.ts`: Root module, imports all feature modules
- `main.ts`: Application bootstrap, CORS, validation setup
- `prisma.service.ts`: Database connection service
- `*.controller.ts`: HTTP request handlers, routing
- `*.service.ts`: Business logic, database operations
- `dto/*.ts`: Data transfer objects, validation schemas

### Frontend Key Files
- `layout.tsx`: Page layouts, navigation, global state
- `page.tsx`: Route components, data fetching
- `api.ts`: Backend API integration functions
- `types/*.ts`: TypeScript interfaces for type safety
- Component files: Reusable UI elements

### Configuration Files
- `package.json`: Dependencies, scripts, project metadata
- `tsconfig.json`: TypeScript compiler options
- `schema.prisma`: Database schema definition
- `docker-compose.yml`: Multi-service deployment setup

## Module Dependencies
```
Frontend (Next.js) 
    ↓ HTTP/WebSocket
Backend (NestJS)
    ↓ Prisma ORM
PostgreSQL Database
```

## Development Workflow
1. **Backend**: Modify schema → Generate Prisma client → Update services → Update controllers
2. **Frontend**: Update types → Modify API calls → Update components → Update pages
3. **Testing**: Unit tests → E2E tests → Integration testing
4. **Deployment**: Docker build → Container orchestration