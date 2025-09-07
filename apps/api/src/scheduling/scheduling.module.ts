import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConflictDetectionService } from './services/conflict-detection.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { AuditLogService } from './services/audit-log.service';
import { CPMScheduler } from './algorithms/cpm-scheduler';
import { ConstraintSolver } from './algorithms/constraint-solver';

@Module({
  imports: [PrismaModule],
  controllers: [SchedulingController],
  providers: [
    SchedulingService,
    ConflictDetectionService,
    ConflictResolutionService,
    AuditLogService,
    CPMScheduler,
    ConstraintSolver
  ],
  exports: [
    SchedulingService,
    ConflictDetectionService,
    ConflictResolutionService,
    AuditLogService
  ],
})
export class SchedulingModule {}