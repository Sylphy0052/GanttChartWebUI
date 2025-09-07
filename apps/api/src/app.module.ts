import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IssuesModule } from './issues/issues.module';
import { ProjectsModule } from './projects/projects.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { TelemetryModule } from './telemetry/telemetry.module'; // T016 AC6: Telemetry API
import { JwtAuthGuard } from './auth/guards/jwt.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // T016 AC6: TypeORM configuration for telemetry data
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'telemetry.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development'
    }),
    PrismaModule,
    AuthModule,
    IssuesModule,
    ProjectsModule,
    SchedulingModule,
    TelemetryModule, // T016 AC6: Add telemetry module
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}