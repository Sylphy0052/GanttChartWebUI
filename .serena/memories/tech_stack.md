# Tech Stack - GanttChart WebUI

## Backend Stack
- **Framework**: NestJS (Node.js framework)
- **Language**: TypeScript 5.1.3
- **Runtime**: Node.js 20+
- **ORM**: Prisma 5.6.0
- **Database**: PostgreSQL 15
- **Authentication**: Basic Auth + bcrypt for password hashing
- **File Upload**: Multer + Sharp (image processing)
- **Real-time**: Socket.IO (WebSocket communication)
- **Archive**: Archiver for backup/export functionality
- **File System**: fs-extra for file operations

## Frontend Stack
- **Framework**: Next.js 15.5.2 (App Router)
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript 5
- **HTTP Client**: Fetch API
- **Real-time**: Socket.IO Client

## Development Tools
- **Linting**: ESLint
- **Code Formatting**: Prettier
- **Testing**: Jest (unit tests), Cypress (E2E tests)
- **Type Checking**: TypeScript strict mode (backend: relaxed, frontend: strict)
- **Database Tools**: Prisma Studio
- **Package Manager**: npm

## Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 15 Alpine
- **Reverse Proxy**: Nginx (in Docker setup)
- **Development**: Hot reload for both backend and frontend

## Key Dependencies

### Backend
- `@nestjs/*`: Core framework modules
- `@prisma/client`: Database client
- `class-validator`: DTO validation
- `class-transformer`: Object transformation
- `socket.io`: WebSocket server
- `sharp`: Image processing
- `archiver`: File compression
- `multer`: File upload handling

### Frontend
- `next`: React framework
- `react`: UI library
- `socket.io-client`: WebSocket client
- `tailwindcss`: CSS framework
- `cypress`: E2E testing

## Database
- **Type**: PostgreSQL 15
- **Schema Management**: Prisma migrations
- **Features**: 
  - Timezone support (Asia/Tokyo)
  - Logical deletion (is_deleted flags)
  - CUID-based IDs
  - Foreign key constraints
  - Optimized indexes