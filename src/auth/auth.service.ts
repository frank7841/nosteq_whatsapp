import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private blacklistedTokens: Set<string> = new Set();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });
    
    const { password, ...result } = user;
    return result;
  }

  async logout(token: string) {
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      // Verify the token is valid before blacklisting
      this.jwtService.verify(token);
      
      // Add token to blacklist
      this.blacklistedTokens.add(token);
      
      return {
        success: true,
        message: 'Successfully logged out',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  isTokenBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  // Clean up expired tokens from blacklist (optional optimization)
  cleanupBlacklist() {
    const now = Math.floor(Date.now() / 1000);
    for (const token of this.blacklistedTokens) {
      try {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.exp && decoded.exp < now) {
          this.blacklistedTokens.delete(token);
        }
      } catch (error) {
        // Remove invalid tokens
        this.blacklistedTokens.delete(token);
      }
    }
  }
}