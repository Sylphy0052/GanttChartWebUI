/**
 * T016 AC6: Telemetry Module
 * 
 * NestJS module for telemetry data collection and processing
 */

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { TelemetryController } from './telemetry.controller'
import { TelemetryService } from './telemetry.service'
import { TelemetryBatch } from './entities/telemetry-batch.entity'
import { TelemetryAnalytics } from './entities/telemetry-analytics.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TelemetryBatch,
      TelemetryAnalytics
    ])
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService]
})
export class TelemetryModule {}