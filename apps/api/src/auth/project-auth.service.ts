import { Injectable, ForbiddenException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface RateLimitResult {
  allowed: boolean;
  attemptsRemaining: number;
  lockedUntil?: Date;
  nextAttemptIn?: number; // seconds until next attempt allowed
}

export interface SessionInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class ProjectAuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  
  // Rate limiting configuration with exponential backoff
  private readonly RATE_LIMIT_CONFIG = {
    5: 5 * 60, // 5 attempts → 5 min lockout
    10: 15 * 60, // 10 attempts → 15 min lockout
    15: 60 * 60, // 15 attempts → 1 hour lockout
    20: 24 * 60 * 60, // 20 attempts → 24 hour lockout
  };

  constructor(private prisma: PrismaService) {}

  /**
   * AC1: Enhanced rate limiting with exponential backoff
   */
  async checkRateLimit(clientId: string, projectId: string, attemptType: string = 'password_project'): Promise<RateLimitResult> {
    const now = new Date();
    
    // Find existing rate limit record
    let rateLimitRecord = await this.prisma.rateLimitAttempt.findUnique({
      where: {
        clientId_attemptType_projectId: {
          clientId,
          attemptType,
          projectId
        }
      }
    });

    // If no record exists, create one and allow the attempt
    if (!rateLimitRecord) {
      await this.prisma.rateLimitAttempt.create({
        data: {
          clientId,
          projectId,
          attemptType,
          attemptsCount: 1,
          firstAttemptAt: now,
          lastAttemptAt: now
        }
      });
      
      return {
        allowed: true,
        attemptsRemaining: 4
      };
    }

    // Check if currently locked
    if (rateLimitRecord.lockedUntil && rateLimitRecord.lockedUntil > now) {
      const nextAttemptIn = Math.ceil((rateLimitRecord.lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        lockedUntil: rateLimitRecord.lockedUntil,
        nextAttemptIn
      };
    }

    // If lock has expired, reset the counter
    if (rateLimitRecord.lockedUntil && rateLimitRecord.lockedUntil <= now) {
      rateLimitRecord = await this.prisma.rateLimitAttempt.update({
        where: { id: rateLimitRecord.id },
        data: {
          attemptsCount: 1,
          firstAttemptAt: now,
          lastAttemptAt: now,
          lockedUntil: null
        }
      });
      
      return {
        allowed: true,
        attemptsRemaining: 4
      };
    }

    // Calculate lockout duration based on attempt count
    const lockoutDuration = this.calculateLockoutDuration(rateLimitRecord.attemptsCount + 1);
    const lockedUntil = lockoutDuration ? new Date(now.getTime() + lockoutDuration * 1000) : null;

    // Update attempt count
    await this.prisma.rateLimitAttempt.update({
      where: { id: rateLimitRecord.id },
      data: {
        attemptsCount: rateLimitRecord.attemptsCount + 1,
        lastAttemptAt: now,
        lockedUntil
      }
    });

    if (lockedUntil) {
      const nextAttemptIn = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        attemptsRemaining: 0,
        lockedUntil,
        nextAttemptIn
      };
    }

    return {
      allowed: true,
      attemptsRemaining: Math.max(0, 5 - (rateLimitRecord.attemptsCount + 1))
    };
  }

  /**
   * Calculate lockout duration based on attempt count (exponential backoff)
   */
  private calculateLockoutDuration(attemptCount: number): number {
    if (attemptCount >= 20) return this.RATE_LIMIT_CONFIG[20];
    if (attemptCount >= 15) return this.RATE_LIMIT_CONFIG[15];
    if (attemptCount >= 10) return this.RATE_LIMIT_CONFIG[10];
    if (attemptCount >= 5) return this.RATE_LIMIT_CONFIG[5];
    return 0; // No lockout for < 5 attempts
  }

  /**
   * AC2: Session-based access token management with 24-hour expiration and refresh capability
   */
  async createSession(projectId: string, clientId: string): Promise<SessionInfo> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate secure tokens
    const accessTokenPayload = {
      projectId,
      clientId,
      type: 'access',
      exp: Math.floor(expiresAt.getTime() / 1000),
      iat: Math.floor(now.getTime() / 1000),
      jti: crypto.randomUUID()
    };

    const refreshTokenPayload = {
      projectId,
      clientId,
      type: 'refresh',
      exp: Math.floor(refreshExpiresAt.getTime() / 1000),
      iat: Math.floor(now.getTime() / 1000),
      jti: crypto.randomUUID()
    };

    const accessToken = jwt.sign(accessTokenPayload, this.JWT_SECRET);
    const refreshToken = jwt.sign(refreshTokenPayload, this.JWT_SECRET);

    // Store session in database
    await this.prisma.authSession.create({
      data: {
        projectId,
        clientId,
        accessToken,
        refreshToken,
        expiresAt,
        refreshExpiresAt
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresAt,
      refreshExpiresAt
    };
  }

  /**
   * AC2: Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<SessionInfo> {
    // Verify refresh token
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, this.JWT_SECRET) as any;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Find and validate session
    const session = await this.prisma.authSession.findFirst({
      where: {
        refreshToken,
        isActive: true,
        refreshExpiresAt: {
          gt: new Date()
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Create new session
    const newSession = await this.createSession(session.projectId, session.clientId);

    // Deactivate old session
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { isActive: false }
    });

    return newSession;
  }

  /**
   * AC3: Log authentication event to ActivityLog
   */
  async logAuthenticationEvent(
    projectId: string,
    clientId: string,
    action: 'login_success' | 'login_failure' | 'lockout' | 'token_refresh' | 'logout',
    metadata?: any
  ): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          projectId,
          entityType: 'auth',
          entityId: `${clientId}_${action}`,
          action,
          actor: clientId,
          metadata: {
            clientId,
            timestamp: new Date().toISOString(),
            ...metadata
          }
        }
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to log authentication event:', error);
    }
  }

  /**
   * AC5: Token blacklist system for secure logout
   */
  async blacklistToken(token: string, tokenType: 'access' | 'refresh', reason?: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Decode token to get expiration
    let expiresAt: Date;
    try {
      const decoded = jwt.decode(token) as any;
      expiresAt = new Date(decoded.exp * 1000);
    } catch (error) {
      // If we can't decode, set expiration to 24 hours from now
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    await this.prisma.tokenBlacklist.create({
      data: {
        tokenHash,
        tokenType,
        expiresAt,
        reason: reason || 'logout'
      }
    });
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const blacklistEntry = await this.prisma.tokenBlacklist.findUnique({
      where: { tokenHash }
    });

    if (!blacklistEntry) return false;

    // If token has expired, it's effectively blacklisted anyway
    if (blacklistEntry.expiresAt <= new Date()) {
      return true;
    }

    return true;
  }

  /**
   * AC5: Secure logout - blacklist both access and refresh tokens
   */
  async logout(accessToken: string, refreshToken?: string, clientId?: string, projectId?: string): Promise<void> {
    // Blacklist access token
    await this.blacklistToken(accessToken, 'access', 'logout');

    // Blacklist refresh token if provided
    if (refreshToken) {
      await this.blacklistToken(refreshToken, 'refresh', 'logout');
    }

    // Deactivate session
    if (refreshToken) {
      await this.prisma.authSession.updateMany({
        where: {
          OR: [
            { accessToken },
            { refreshToken }
          ]
        },
        data: { isActive: false }
      });
    }

    // Log logout event
    if (clientId && projectId) {
      await this.logAuthenticationEvent(projectId, clientId, 'logout', {
        accessToken: accessToken.substring(0, 20) + '...',
        refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : undefined
      });
    }
  }

  /**
   * Verify access token and return session info
   */
  async verifyAccessToken(token: string): Promise<{ projectId: string; clientId: string; payload: any }> {
    // Check if token is blacklisted first
    const isBlacklisted = await this.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    // Verify JWT
    let payload: any;
    try {
      payload = jwt.verify(token, this.JWT_SECRET) as any;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Check if session is still active
    const session = await this.prisma.authSession.findFirst({
      where: {
        accessToken: token,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException('Session not found or expired');
    }

    return {
      projectId: payload.projectId,
      clientId: payload.clientId,
      payload
    };
  }

  /**
   * AC6: Admin override mechanism for emergency project access
   */
  async createAdminOverride(projectId: string, adminUserId: string, reason: string, expirationHours: number = 24): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);
    
    // Generate secure override token
    const overrideToken = `override_${crypto.randomUUID()}_${crypto.randomBytes(16).toString('hex')}`;

    await this.prisma.adminOverrideToken.create({
      data: {
        projectId,
        adminUserId,
        overrideToken,
        reason,
        expiresAt
      }
    });

    // Log the override creation
    await this.logAuthenticationEvent(projectId, adminUserId, 'login_success', {
      type: 'admin_override',
      reason,
      expirationHours
    });

    return overrideToken;
  }

  /**
   * AC6: Validate admin override token
   */
  async validateAdminOverride(projectId: string, overrideToken: string): Promise<boolean> {
    const override = await this.prisma.adminOverrideToken.findFirst({
      where: {
        projectId,
        overrideToken,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!override) {
      return false;
    }

    // Mark as used
    await this.prisma.adminOverrideToken.update({
      where: { id: override.id },
      data: {
        usedAt: new Date()
      }
    });

    return true;
  }

  /**
   * Reset rate limiting for a client (for admin use)
   */
  async resetRateLimit(clientId: string, projectId?: string, attemptType: string = 'password_project'): Promise<void> {
    if (projectId) {
      await this.prisma.rateLimitAttempt.deleteMany({
        where: {
          clientId,
          projectId,
          attemptType
        }
      });
    } else {
      await this.prisma.rateLimitAttempt.deleteMany({
        where: {
          clientId,
          attemptType
        }
      });
    }
  }

  /**
   * Clean up expired sessions and blacklisted tokens
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    
    // Clean up expired sessions
    await this.prisma.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { refreshExpiresAt: { lte: now } }
        ]
      }
    });

    // Clean up expired blacklisted tokens
    await this.prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: { lte: now }
      }
    });

    // Clean up expired rate limit attempts
    await this.prisma.rateLimitAttempt.deleteMany({
      where: {
        lockedUntil: { lte: now }
      }
    });

    // Clean up expired admin override tokens
    await this.prisma.adminOverrideToken.deleteMany({
      where: {
        expiresAt: { lte: now }
      }
    });
  }
}