/**
 * T029: Metrics Module
 * 
 * Provides ROI measurement and business metrics functionality
 */

import { Module } from '@nestjs/common'
import { ROIController } from './roi.controller'
import { ROIService } from './roi.service'
import { PrismaModule } from '../prisma/prisma.module'
import { TelemetryModule } from '../telemetry/telemetry.module'

@Module({
  imports: [
    PrismaModule,
    TelemetryModule
  ],
  controllers: [ROIController],
  providers: [ROIService],
  exports: [ROIService]
})
export class MetricsModule {}