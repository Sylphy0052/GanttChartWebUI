import { Module } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ConflictDetectionService } from '../scheduling/services/conflict-detection.service';
import { ETagInterceptor } from '../scheduling/interceptors/etag.interceptor';

@Module({
  imports: [PrismaModule],
  controllers: [IssuesController],
  providers: [
    IssuesService, 
    ConflictDetectionService,
    ETagInterceptor
  ],
  exports: [IssuesService],
})
export class IssuesModule {}