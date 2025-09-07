/**
 * T016 AC6: Telemetry Module
 * 
 * NestJS module for telemetry data collection and processing
 * TEMPORARY: TypeORM dependencies commented out for Docker startup fix
 */

import { Module } from '@nestjs/common'
// import { TypeOrmModule } from '@nestjs/typeorm' // TEMP: Commented out for Prisma compatibility
import { TelemetryController } from './telemetry.controller'
import { TelemetryService } from './telemetry.service'
// import { TelemetryBatch } from './entities/telemetry-batch.entity' // TEMP: Commented out
// import { TelemetryAnalytics } from './entities/telemetry-analytics.entity' // TEMP: Commented out

@Module({
  imports: [
    // TEMP: TypeORM import commented out for Docker startup fix
    // TypeOrmModule.forFeature([
    //   TelemetryBatch,
    //   TelemetryAnalytics
    // ])
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService]
})
export class TelemetryModule {}