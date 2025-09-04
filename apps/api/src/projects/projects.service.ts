import { Injectable, NotFoundException, BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectPasswordDto, ProjectAccessDto } from './dto/project-access.dto';
import * as argon2 from 'argon2';

@Injectable()
export class ProjectsService {
  // Rate limiting for password attempts
  private readonly attemptTracker = new Map<string, {count: number, resetAt: number}>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(private prisma: PrismaService) {}

  async create(data: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: data.name,
        visibility: data.visibility || 'private'
      }
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose passwordHash in listings
      }
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose passwordHash
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, data: UpdateProjectDto) {
    const project = await this.findOne(id); // Validates existence
    
    return this.prisma.project.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
      }
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Validates existence
    
    return this.prisma.project.delete({
      where: { id }
    });
  }

  // Password management methods
  async setProjectPassword(id: string, passwordDto: ProjectPasswordDto) {
    const project = await this.findOne(id); // Validates existence

    if (project.visibility !== 'password') {
      throw new BadRequestException('Project must have password visibility to set a password');
    }

    const passwordHash = await this.hashPassword(passwordDto.password);
    
    return this.prisma.project.update({
      where: { id },
      data: { passwordHash },
      select: {
        id: true,
        name: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        // Don't return passwordHash
      }
    });
  }

  async authenticateProjectAccess(id: string, accessDto: ProjectAccessDto, clientId: string): Promise<{ accessToken: string; expiresAt: number }> {
    // Check rate limit first
    if (!this.checkRateLimit(clientId)) {
      const remainingAttempts = this.getRemainingAttempts(clientId);
      throw new HttpException(`Too many password attempts. Try again later. Remaining attempts: ${remainingAttempts}`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        visibility: true,
        passwordHash: true,
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.visibility !== 'password') {
      throw new BadRequestException('Project does not require password authentication');
    }

    if (!project.passwordHash) {
      throw new BadRequestException('Project password not set');
    }

    const isValidPassword = await this.verifyPassword(accessDto.password, project.passwordHash);
    if (!isValidPassword) {
      this.recordFailedAttempt(clientId);
      throw new ForbiddenException('Invalid password');
    }

    // Generate simple access token (24-hour expiry)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    const accessToken = Buffer.from(`${project.id}:${expiresAt}`).toString('base64');

    return {
      accessToken,
      expiresAt
    };
  }

  // Password hashing functionality using Argon2id
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 32768,    // 32MB
      timeCost: 3,          // 3 iterations
      parallelism: 1,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      // Log error for security monitoring
      console.error('Password verification error:', error);
      return false;
    }
  }

  // Rate limiting methods
  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const attempts = this.attemptTracker.get(clientId);
    
    if (!attempts || now > attempts.resetAt) {
      this.attemptTracker.set(clientId, {count: 1, resetAt: now + this.WINDOW_MS});
      return true;
    }
    
    if (attempts.count >= this.MAX_ATTEMPTS) {
      return false;
    }
    
    attempts.count++;
    return true;
  }

  recordFailedAttempt(clientId: string): void {
    // Failed attempts are already recorded in checkRateLimit
    // This method can be used for additional logging/monitoring
    console.warn(`Failed password attempt for client: ${clientId}`);
  }

  getRemainingAttempts(clientId: string): number {
    const now = Date.now();
    const attempts = this.attemptTracker.get(clientId);
    
    if (!attempts || now > attempts.resetAt) {
      return this.MAX_ATTEMPTS;
    }
    
    return Math.max(0, this.MAX_ATTEMPTS - attempts.count);
  }
}