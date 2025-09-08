# Coding Standards - GanttChart WebUI

## TypeScript Configuration

### Backend
- **Target**: ES2020
- **Module**: CommonJS
- **Decorators**: Enabled (experimentalDecorators, emitDecoratorMetadata)
- **Strict Mode**: Relaxed (for rapid development)
  - `strictNullChecks: false`
  - `noImplicitAny: false`
  - `strictBindCallApply: false`

### Frontend
- **Target**: ES2022+ (Next.js default)
- **Module**: ES modules
- **Strict Mode**: Enabled (Next.js default)

## NestJS Backend Patterns

### Module Structure
```typescript
@Module({
  imports: [],
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService]
})
export class FeatureModule {}
```

### Controller Pattern
```typescript
@Controller('api/feature')
@UseGuards(AuthGuard)
export class FeatureController {
  @Get()
  async findAll(): Promise<FeatureDto[]> {}
  
  @Post()
  @UseGuards(RoleGuard('editor'))
  async create(@Body() createDto: CreateFeatureDto) {}
}
```

### Service Pattern
```typescript
@Injectable()
export class FeatureService {
  constructor(private prisma: PrismaService) {}
  
  async findAll(): Promise<Feature[]> {
    return this.prisma.feature.findMany({
      where: { is_deleted: false }
    });
  }
}
```

### DTO Pattern
```typescript
export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  
  @IsOptional()
  @IsString()
  description?: string;
}
```

## Next.js Frontend Patterns

### App Router Structure
```
src/app/
  layout.tsx          # Root layout
  page.tsx           # Home page
  projects/
    page.tsx         # Projects list
    [id]/
      page.tsx       # Project detail
      layout.tsx     # Project layout
```

### Component Pattern
```typescript
'use client';

interface ComponentProps {
  data: DataType;
  onAction?: (id: string) => void;
}

export function Component({ data, onAction }: ComponentProps) {
  return <div>{/* JSX */}</div>;
}
```

### API Integration
```typescript
// In lib/api.ts
export const api = {
  projects: {
    getAll: () => fetch('/api/projects').then(r => r.json()),
    create: (data: CreateProjectData) => 
      fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
  }
};
```

## Database Patterns (Prisma)

### Schema Conventions
```prisma
model Entity {
  id         String   @id @default(cuid())
  created_at DateTime @default(now()) @db.Timestamptz(3)
  updated_at DateTime @updatedAt @db.Timestamptz(3)
  is_deleted Boolean  @default(false)
  
  @@map("entities")
  @@index([is_deleted])
}
```

### Query Patterns
```typescript
// Always filter out soft-deleted records
const entities = await prisma.entity.findMany({
  where: { is_deleted: false }
});

// Soft delete
await prisma.entity.update({
  where: { id },
  data: { is_deleted: true }
});
```

## File & Directory Naming
- **Files**: kebab-case (`feature-name.service.ts`)
- **Directories**: kebab-case (`feature-name/`)
- **Classes**: PascalCase (`FeatureService`)
- **Interfaces**: PascalCase (`FeatureInterface`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PAGE_SIZE`)
- **Variables**: camelCase (`featureName`)

## Import Conventions
```typescript
// Backend imports order:
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateFeatureDto } from './dto/create-feature.dto';

// Frontend imports order:
import React from 'react';
import { NextPage } from 'next';
import { Component } from '@/components/ui/component';
```

## Error Handling
```typescript
// Backend
throw new HttpException('Resource not found', HttpStatus.NOT_FOUND);

// Frontend
try {
  const data = await api.call();
} catch (error) {
  console.error('API call failed:', error);
  // Handle user-facing error
}
```

## Authentication Patterns
```typescript
// Backend role checking
@UseGuards(RoleGuard('editor'))
async editorOnlyAction() {}

// Frontend permission checking
{hasEditPermission && (
  <EditButton onClick={handleEdit} />
)}
```

## Code Quality Requirements
- **ESLint**: Must pass without errors
- **Prettier**: Auto-format on save
- **TypeScript**: Compile without errors
- **Tests**: Unit tests for services, E2E for critical paths
- **No unused imports/variables**
- **Descriptive variable names**
- **JSDoc comments for public APIs**