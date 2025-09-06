import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

// Enhanced demo users with RBAC context
const DEMO_USERS = [
  { id: 'user-1', email: 'admin@example.com', name: 'Admin User', password: 'admin123', role: 'admin' },
  { id: 'user-2', email: 'user@example.com', name: 'Test User', password: 'user123', role: 'member' },
  { id: 'user-3', email: 'demo@example.com', name: 'Demo User', password: 'demo123', role: 'viewer' }
];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(email: string, password: string) {
    const user = DEMO_USERS.find(u => u.email === email && u.password === password);
    if (!user) {
      return null;
    }
    
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role, // Include role for RBAC
      },
    };
  }

  async getProfile(userId: string) {
    const user = DEMO_USERS.find(u => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password: _, ...result } = user;
    return result;
  }

  // Basic RBAC helper methods (simplified for PoC)
  async getUserProjectRole(userId: string, projectId: string): Promise<string | null> {
    const user = DEMO_USERS.find(u => u.id === userId);
    // For PoC, return user's default role
    return user?.role || 'viewer';
  }

  async checkProjectPermission(userId: string, projectId: string, permission: string): Promise<boolean> {
    const role = await this.getUserProjectRole(userId, projectId);
    
    if (!role) {
      return false;
    }

    // Simple role-based permissions for PoC
    switch (role) {
      case 'admin':
        return true; // Admins can do everything
      case 'member':
        return permission !== 'deleteProject'; // Members can't delete projects
      case 'viewer':
        return permission === 'viewProject'; // Viewers can only view
      default:
        return false;
    }
  }
}