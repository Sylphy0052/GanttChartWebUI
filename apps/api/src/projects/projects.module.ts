import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectAuthService } from '../auth/project-auth.service';
import { IssuesModule } from '../issues/issues.module';

@Module({
  imports: [IssuesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAuthService],
  exports: [ProjectsService, ProjectAuthService],
})
export class ProjectsModule {}