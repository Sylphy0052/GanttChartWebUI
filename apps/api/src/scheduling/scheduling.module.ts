import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { AuditLogService } from './services/audit-log.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchedulingController],
  providers: [
    SchedulingService,
    ConflictDetectionService,
    ConflictResolutionService,
    AuditLogService
  ],
  exports: [
    SchedulingService,
    ConflictDetectionService,
    ConflictResolutionService,
    AuditLogService
  ],
})
export class SchedulingModule {}