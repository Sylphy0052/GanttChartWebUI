import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsOptimizedService } from './projects-optimized.service';
import { ProjectsEnhancedService } from './projects-enhanced.service';
import { ProjectsController } from './projects.controller';
import { ProjectAuthService } from '../auth/project-auth.service';
import { IssuesModule } from '../issues/issues.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaPerformanceService } from '../prisma/prisma-performance.service';

@Module({
  imports: [IssuesModule, PrismaModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService, 
    ProjectsOptimizedService,
    ProjectsEnhancedService,
    ProjectAuthService,
    PrismaPerformanceService
  ],
  exports: [
    ProjectsService, 
    ProjectsOptimizedService,
    ProjectsEnhancedService,
    ProjectAuthService
  ],
})
export class ProjectsModule {}