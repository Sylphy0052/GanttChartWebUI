import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

// 簡易実装: 実際のプロダクションではデータベースから取得
const DEMO_USERS = [
  { id: '1', email: 'admin@example.com', name: 'Admin User', password: 'admin123' },
  { id: '2', email: 'user@example.com', name: 'Test User', password: 'user123' },
  { id: '3', email: 'demo@example.com', name: 'Demo User', password: 'demo123' }
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
}