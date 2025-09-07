import { Module } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaPerformanceService } from '../prisma/prisma-performance.service';

@Module({
  imports: [PrismaModule],
  controllers: [PerformanceController],
  providers: [PrismaPerformanceService],
  exports: [PrismaPerformanceService],
})
export class PerformanceModule {}