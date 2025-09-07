import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  HttpException, 
  HttpStatus,
  Logger,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

/**
 * レート制限設定
 */
export interface RateLimitConfig {
  requests: number;      // 許可リクエスト数
  windowMs: number;      // 時間窓（ミリ秒）
  message?: string;      // 制限時のメッセージ
  skipIf?: (req: Request) => boolean; // スキップ条件
}

/**
 * リクエスト記録
 */
interface RequestRecord {
  count: number;
  resetTime: number;
}

/**
 * デコレーター用のメタデータキー
 */
export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * レート制限デコレーター
 * @param config レート制限設定
 * @returns デコレーター
 */
export const RateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);

/**
 * RateLimitGuard - API制限ガード
 * 
 * 機能:
 * - IPアドレス単位でのリクエスト制限
 * - カスタマイズ可能な制限設定
 * - インメモリストレージ（シンプル実装）
 * - 詳細なロギング
 * - スキップ条件の設定可能
 * 
 * 使用例:
 * ```typescript
 * @RateLimit({ requests: 100, windowMs: 15 * 60 * 1000 }) // 15分間に100回
 * @UseGuards(RateLimitGuard)
 * async someEndpoint() { ... }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly requestStore = new Map<string, RequestRecord>();
  
  // デフォルト設定
  private readonly defaultConfig: RateLimitConfig = {
    requests: 100,           // 100リクエスト
    windowMs: 15 * 60 * 1000, // 15分
    message: 'Too Many Requests. Please try again later.',
  };

  constructor(private readonly reflector: Reflector) {
    // 定期的なクリーンアップ（メモリリーク防止）
    setInterval(() => this.cleanup(), 60000); // 1分ごと
  }

  /**
   * ガード実行
   * @param context 実行コンテキスト
   * @returns 実行許可の可否
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // メタデータからレート制限設定を取得
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      handler,
    ) || this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      controller,
    );

    // レート制限が設定されていない場合はスキップ
    if (!config) {
      return true;
    }

    // スキップ条件をチェック
    if (config.skipIf && config.skipIf(request)) {
      this.logger.debug(`Rate limit skipped for ${request.ip}`);
      return true;
    }

    // レート制限チェック実行
    return this.checkRateLimit(request, config);
  }

  /**
   * レート制限チェック
   * @param request リクエスト
   * @param config 制限設定
   * @returns 許可の可否
   */
  private checkRateLimit(request: Request, config: RateLimitConfig): boolean {
    const clientIp = this.getClientIp(request);
    const key = this.generateKey(clientIp, request.route?.path || request.path);
    const now = Date.now();
    const windowMs = config.windowMs || this.defaultConfig.windowMs;
    const maxRequests = config.requests || this.defaultConfig.requests;

    // 既存の記録を取得または新規作成
    let record = this.requestStore.get(key);
    
    if (!record || now >= record.resetTime) {
      // 新しい時間窓の開始
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.requestStore.set(key, record);
      
      this.logger.debug(
        `Rate limit initialized for ${clientIp}: 1/${maxRequests} requests`
      );
      return true;
    }

    // リクエスト数を増加
    record.count++;

    if (record.count > maxRequests) {
      const remainingTime = Math.ceil((record.resetTime - now) / 1000);
      
      this.logger.warn(
        `Rate limit exceeded for ${clientIp}: ${record.count}/${maxRequests} requests. Reset in ${remainingTime}s`
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: config.message || this.defaultConfig.message,
          error: 'Too Many Requests',
          retryAfter: remainingTime,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(
      `Rate limit check passed for ${clientIp}: ${record.count}/${maxRequests} requests`
    );

    return true;
  }

  /**
   * クライアントIPアドレスを取得
   * @param request リクエスト
   * @returns IPアドレス
   */
  private getClientIp(request: Request): string {
    // プロキシ経由の場合のIPアドレス取得
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.ip ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * レート制限キーを生成
   * @param ip IPアドレス
   * @param path リクエストパス
   * @returns キー
   */
  private generateKey(ip: string, path: string): string {
    // IPとパスでキーを生成（パス別制限が可能）
    return `${ip}:${path}`;
  }

  /**
   * 期限切れのレコードをクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, record] of this.requestStore.entries()) {
      if (now >= record.resetTime) {
        this.requestStore.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  /**
   * 統計情報を取得（デバッグ用）
   * @returns 統計情報
   */
  getStats(): { activeRecords: number; totalMemory: string } {
    const activeRecords = this.requestStore.size;
    const totalMemory = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;

    return {
      activeRecords,
      totalMemory,
    };
  }

  /**
   * すべてのレート制限記録をクリア（テスト用）
   */
  clearAll(): void {
    this.requestStore.clear();
    this.logger.log('All rate limit records cleared');
  }
}