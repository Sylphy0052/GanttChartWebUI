import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private startTime = Date.now();

  getHealth() {
    return {
      message: 'Gantt Chart API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  getDetailedHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      database: 'connected' // TODO: Add actual database health check
    };
  }
}