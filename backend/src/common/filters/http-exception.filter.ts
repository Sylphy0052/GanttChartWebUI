import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * HttpExceptionFilter - グローバル例外フィルター
 * 
 * 統一されたエラーレスポンス形式を提供
 * Prismaエラーを適切なHTTPステータスコードにマッピング
 * ログ出力とエラートラッキング
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      // NestJSの標準HTTP例外
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || 'Internal server error';
        error = responseObj.error || exception.constructor.name;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prismaの既知のエラー
      ({ status, message, error } = this.handlePrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      // Prismaの未知のエラー
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'データベースエラーが発生しました';
      error = 'DatabaseError';
      this.logger.error('Prisma unknown error', exception);
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Prismaのバリデーションエラー
      status = HttpStatus.BAD_REQUEST;
      message = 'リクエストデータが不正です';
      error = 'ValidationError';
      this.logger.warn('Prisma validation error', exception.message);
    } else {
      // その他の予期しないエラー
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '内部サーバーエラーが発生しました';
      error = 'InternalServerError';
      this.logger.error('Unexpected error', exception);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    // エラーログの出力
    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      JSON.stringify(errorResponse),
    );

    response.status(status).json(errorResponse);
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
  } {
    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        const target = exception.meta?.target as string[];
        const field = target?.[0] || 'フィールド';
        return {
          status: HttpStatus.CONFLICT,
          message: `${field}は既に使用されています`,
          error: 'ConflictError',
        };
      
      case 'P2025':
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: '指定されたリソースが見つかりません',
          error: 'NotFoundError',
        };
      
      case 'P2003':
        // Foreign key constraint violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: '関連するデータが存在しないため操作できません',
          error: 'ForeignKeyError',
        };
      
      case 'P2014':
        // Required relation is missing
        return {
          status: HttpStatus.BAD_REQUEST,
          message: '必要な関連データが不足しています',
          error: 'RelationError',
        };
      
      default:
        this.logger.error(`Unhandled Prisma error code: ${exception.code}`, exception);
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'データベースエラーが発生しました',
          error: 'DatabaseError',
        };
    }
  }
}