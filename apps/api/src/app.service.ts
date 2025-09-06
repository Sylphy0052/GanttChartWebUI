import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  getHealth() {
    return {
      message: 'Gantt Chart API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  async getDetailedHealth() {
    let databaseStatus = 'disconnected';
    let databaseError = null;

    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'error';
      databaseError = error.message;
    }

    return {
      status: databaseStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      database: databaseStatus,
      ...(databaseError && { databaseError }),
      environment: process.env.NODE_ENV || 'unknown'
    };
  }
}