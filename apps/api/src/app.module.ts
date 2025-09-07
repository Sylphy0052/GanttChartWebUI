import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IssuesModule } from './issues/issues.module';
import { ProjectsModule } from './projects/projects.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { PerformanceModule } from './performance/performance.module'; // T039: Database performance monitoring
// import { TelemetryModule } from './telemetry/telemetry.module'; // T016 AC6: Telemetry API
import { MetricsModule } from './metrics/metrics.module'; // T029: ROI measurement system
import { IntegrationsModule } from './integrations/integrations.module'; // T034 AC1: External Integration
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { CacheService } from './common/services/cache.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // T038 AC3: Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      }
    ]),
    // T016 AC6: TypeORM configuration for telemetry data - temporarily disabled
    // TypeOrmModule.forRoot({
    //   type: 'sqlite',
    //   database: 'telemetry.db',
    //   entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //   synchronize: process.env.NODE_ENV === 'development',
    //   logging: process.env.NODE_ENV === 'development'
    // }),
    PrismaModule,
    AuthModule,
    IssuesModule,
    ProjectsModule,
    SchedulingModule,
    PerformanceModule, // T039: Database performance monitoring
    // TelemetryModule, // T016 AC6: Add telemetry module - temporarily disabled
    MetricsModule, // T029: Add ROI metrics module
    IntegrationsModule, // T034 AC1: Add external integration module
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheService, // T036: Global cache service
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // T038 AC3: Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}