import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class SecurityExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SecurityExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        errors = responseObj.errors;
      } else {
        message = exceptionResponse as string;
      }
    }

    // Log security-relevant errors
    if (status >= 400) {
      this.logger.warn(
        `Security event: ${status} ${request.method} ${request.url}`,
        {
          ip: request.ip,
          userAgent: request.get('user-agent'),
          status,
          error: exception instanceof Error ? exception.message : 'Unknown error',
        }
      );
    }

    // Log internal server errors with full details
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('Internal server error', exception);
    }

    // Sanitize error response to prevent information disclosure
    const sanitizedResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: this.sanitizeErrorMessage(status, message),
      ...(errors && { errors: this.sanitizeValidationErrors(errors) }),
    };

    response.status(status).json(sanitizedResponse);
  }

  private sanitizeErrorMessage(status: number, message: string | string[]): string | string[] {
    // For 5xx errors, don't expose internal details
    if (status >= 500) {
      return 'Internal server error';
    }

    // For validation errors (400), allow specific messages
    if (status === HttpStatus.BAD_REQUEST) {
      return message;
    }

    // For authentication/authorization errors, provide generic messages
    if (status === HttpStatus.UNAUTHORIZED) {
      return 'Authentication required';
    }

    if (status === HttpStatus.FORBIDDEN) {
      return 'Access denied';
    }

    // For other client errors, return the message as-is
    return message;
  }

  private sanitizeValidationErrors(errors: any): any {
    if (Array.isArray(errors)) {
      return errors.map(error => this.sanitizeSingleError(error));
    }
    
    if (typeof errors === 'object') {
      return this.sanitizeSingleError(errors);
    }
    
    return errors;
  }

  private sanitizeSingleError(error: any): any {
    if (typeof error === 'string') {
      return error;
    }
    
    if (typeof error === 'object' && error !== null) {
      // Remove potentially sensitive fields
      const { stack, ...sanitized } = error;
      return sanitized;
    }
    
    return error;
  }
}