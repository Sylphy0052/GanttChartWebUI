import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  PreconditionFailedException
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';

export const ETAG_ENABLED_KEY = 'etag_enabled';
export const ETagEnabled = () => Reflector.createDecorator<boolean>();

interface EntityWithVersion {
  id: string;
  version: number;
  updatedAt?: Date;
}

@Injectable()
export class ETagInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isETagEnabled = this.reflector.get<boolean>(
      ETAG_ENABLED_KEY,
      context.getHandler()
    );

    if (!isETagEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method.toLowerCase();

    // Handle If-Match header for updates
    if (['patch', 'put', 'delete'].includes(method)) {
      this.handleIfMatch(request);
    }

    return next.handle().pipe(
      map(data => {
        // Set ETag header for responses
        if (data && (method === 'get' || method === 'patch' || method === 'put' || method === 'post')) {
          const etag = this.generateETag(data);
          if (etag) {
            response.set('ETag', etag);
            
            // Set Cache-Control for better client-side caching
            response.set('Cache-Control', 'private, must-revalidate');
          }
        }

        return data;
      })
    );
  }

  private handleIfMatch(request: any): void {
    const ifMatch = request.headers['if-match'];
    const ifNoneMatch = request.headers['if-none-match'];

    if (!ifMatch && !ifNoneMatch) {
      return; // No conditional headers present
    }

    // Extract entity information from request
    const entityId = request.params.id;
    const version = request.body?.version;

    if (ifMatch) {
      // If-Match: Client expects specific version
      const expectedETag = ifMatch.replace(/"/g, '');
      
      if (version) {
        const currentETag = this.generateVersionETag(entityId, version);
        if (currentETag !== expectedETag) {
          throw new PreconditionFailedException(
            'If-Match precondition failed - entity has been modified'
          );
        }
      }
    }

    if (ifNoneMatch) {
      // If-None-Match: Client wants to avoid overwriting
      const unwantedETag = ifNoneMatch.replace(/"/g, '');
      
      if (version) {
        const currentETag = this.generateVersionETag(entityId, version);
        if (currentETag === unwantedETag) {
          throw new ConflictException(
            'If-None-Match condition failed - entity already exists with this version'
          );
        }
      }
    }
  }

  private generateETag(data: any): string | null {
    if (!data) return null;

    try {
      // Handle single entity
      if (this.isEntityWithVersion(data)) {
        return this.generateVersionETag(data.id, data.version, data.updatedAt);
      }

      // Handle array of entities
      if (Array.isArray(data)) {
        const entityETags = data
          .filter(item => this.isEntityWithVersion(item))
          .map(item => this.generateVersionETag(item.id, item.version, item.updatedAt));

        if (entityETags.length > 0) {
          return this.generateCollectionETag(entityETags);
        }
      }

      // Handle paginated response
      if (data.items && Array.isArray(data.items)) {
        const entityETags = data.items
          .filter((item: any) => this.isEntityWithVersion(item))
          .map((item: any) => this.generateVersionETag(item.id, item.version, item.updatedAt));

        if (entityETags.length > 0) {
          // Include pagination info in ETag
          const paginationInfo = {
            page: data.page || 1,
            limit: data.limit || 10,
            total: data.total || 0
          };
          return this.generateCollectionETag([...entityETags, JSON.stringify(paginationInfo)]);
        }
      }

      return null;
    } catch (error) {
      // If ETag generation fails, don't block the response
      return null;
    }
  }

  private generateVersionETag(id: string, version: number, updatedAt?: Date): string {
    const versionInfo = `${id}:${version}`;
    const timestampInfo = updatedAt ? `:${updatedAt.getTime()}` : '';
    const combined = versionInfo + timestampInfo;
    
    const hash = crypto.createHash('md5').update(combined).digest('hex');
    return `"${hash}"`;
  }

  private generateCollectionETag(entityETags: string[]): string {
    const combined = entityETags.sort().join('|');
    const hash = crypto.createHash('md5').update(combined).digest('hex');
    return `"collection-${hash}"`;
  }

  private isEntityWithVersion(obj: any): obj is EntityWithVersion {
    return obj && 
           typeof obj === 'object' && 
           typeof obj.id === 'string' && 
           typeof obj.version === 'number';
  }
}

/**
 * ETag validation decorator
 */
export function ValidateETag() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // This decorator works in conjunction with ETagInterceptor
      // Additional validation logic can be added here if needed
      return originalMethod.apply(this, args);
    };

    // Mark the method as ETag-enabled
    Reflect.defineMetadata(ETAG_ENABLED_KEY, true, descriptor.value);

    return descriptor;
  };
}

/**
 * Strong ETag validator for critical operations
 */
export function StrongETagValidation() {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      // Extract request context (this assumes NestJS controller context)
      const request = args.find(arg => arg && arg.headers);
      
      if (request && !request.headers['if-match']) {
        throw new PreconditionFailedException(
          'If-Match header required for this operation'
        );
      }

      return originalMethod.apply(this, args);
    };

    Reflect.defineMetadata(ETAG_ENABLED_KEY, true, descriptor.value);

    return descriptor;
  };
}