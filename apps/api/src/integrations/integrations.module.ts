/**
 * T034 AC1: External Integration Module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IssueSyncService } from './services/issue-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IssuesModule } from '../issues/issues.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ConfigModule, PrismaModule, IssuesModule, ProjectsModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IssueSyncService],
  exports: [IntegrationsService, IssueSyncService],
})
export class IntegrationsModule {}