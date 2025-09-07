import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class PerformanceMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceMonitoringInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent');
    
    return next.handle().pipe(
      tap({
        next: () => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const statusCode = response.statusCode;
          
          // Log performance metrics
          this.logPerformanceMetric({
            method,
            url,
            statusCode,
            duration,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
          });
          
          // Set performance headers
          response.setHeader('X-Response-Time', `${duration}ms`);
          response.setHeader('X-Timestamp', new Date().toISOString());
        },
        error: (error) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const statusCode = response.statusCode || 500;
          
          this.logPerformanceMetric({
            method,
            url,
            statusCode,
            duration,
            ip,
            userAgent,
            timestamp: new Date().toISOString(),
            error: error.message,
          });
        },
      }),
    );
  }

  private logPerformanceMetric(metric: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    ip: string;
    userAgent?: string;
    timestamp: string;
    error?: string;
  }): void {
    const { method, url, statusCode, duration, ip, error } = metric;
    
    // Determine log level based on performance and status
    if (error || statusCode >= 500) {
      this.logger.error(
        `${method} ${url} - ${statusCode} - ${duration}ms - ${ip}${error ? ` - Error: ${error}` : ''}`,
        {
          ...metric,
          category: 'api_performance',
          severity: 'error',
        }
      );
    } else if (duration > 2000 || statusCode >= 400) {
      this.logger.warn(
        `${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`,
        {
          ...metric,
          category: 'api_performance',
          severity: 'warning',
        }
      );
    } else if (duration > 1000) {
      this.logger.log(
        `${method} ${url} - ${statusCode} - ${duration}ms - ${ip}`,
        {
          ...metric,
          category: 'api_performance',
          severity: 'info',
        }
      );
    }

    // Log slow queries (over 500ms) for analysis
    if (duration > 500) {
      this.logger.warn(
        `SLOW REQUEST: ${method} ${url} took ${duration}ms`,
        {
          ...metric,
          category: 'slow_request',
          threshold_exceeded: true,
        }
      );
    }
  }
}