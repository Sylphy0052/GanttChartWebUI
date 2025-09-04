import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip project access check if marked as public endpoint
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const projectId = request.params.id || request.body.projectId;
    
    if (!projectId) {
      // If no project ID is present, let the endpoint handle it
      return true;
    }

    try {
      // Get project visibility
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          visibility: true,
        }
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Allow access based on visibility
      switch (project.visibility) {
        case 'public':
          return true;

        case 'private':
          // Private projects require authentication (handled by JWT guard)
          return true;

        case 'password':
          return this.checkPasswordProjectAccess(request, projectId);

        default:
          throw new ForbiddenException('Invalid project visibility setting');
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      // Log unexpected errors for monitoring
      console.error('Project access guard error:', error);
      throw new ForbiddenException('Project access verification failed');
    }
  }

  private checkPasswordProjectAccess(request: any, projectId: string): boolean {
    // Check for access token in headers
    const accessToken = request.headers['x-project-access-token'];
    
    if (!accessToken) {
      throw new ForbiddenException('Project requires password authentication. Please provide access token.');
    }

    try {
      // Decode and validate access token
      const decoded = Buffer.from(accessToken, 'base64').toString();
      const [tokenProjectId, expiresAtStr] = decoded.split(':');
      
      if (tokenProjectId !== projectId) {
        throw new ForbiddenException('Access token is not valid for this project');
      }

      const expiresAt = parseInt(expiresAtStr, 10);
      if (Date.now() > expiresAt) {
        throw new ForbiddenException('Access token has expired. Please re-authenticate.');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Invalid access token format');
    }
  }
}