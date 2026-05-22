import { createHash } from 'crypto';

import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number | null;
}

@Injectable()
export class AuthService {
  /** In-memory brute-force tracking: key = lowercased username */
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getAttemptKey(username: string): string {
    return username.toLowerCase().trim();
  }

  private checkLockout(key: string): void {
    const record = this.loginAttempts.get(key);
    if (!record) return;
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const remainingMs = record.lockedUntil - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new HttpException(
        `Забагато невдалих спроб. Спробуйте через ${remainingMin} хв.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Lockout expired — reset
    if (record.lockedUntil && Date.now() >= record.lockedUntil) {
      this.loginAttempts.delete(key);
    }
  }

  private recordFailure(key: string): void {
    const existing = this.loginAttempts.get(key) ?? { count: 0, lockedUntil: null };
    const count = existing.count + 1;
    const lockedUntil = count >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : null;
    this.loginAttempts.set(key, { count, lockedUntil });
  }

  private clearAttempts(key: string): void {
    this.loginAttempts.delete(key);
  }

  async login(dto: LoginDto) {
    const key = this.getAttemptKey(dto.username);
    this.checkLockout(key);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.username }, { phone: dto.username }],
      },
    });

    if (!user || !user.isActive) {
      this.recordFailure(key);
      throw new UnauthorizedException('Невірний логін або пароль');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      this.recordFailure(key);
      throw new UnauthorizedException('Невірний логін або пароль');
    }

    this.clearAttempts(key);

    const payload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
    });
    const refreshTtlSec = Number(process.env.JWT_REFRESH_TTL_SEC ?? 2592000);
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: refreshTtlSec },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtlSec * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
      user: {
        id: user.id,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    let decoded: { sub: string; role: string; tokenType?: string };
    try {
      decoded = await this.jwtService.verifyAsync(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token недійсний');
    }

    if (decoded.tokenType !== 'refresh') {
      throw new UnauthorizedException('Невірний refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(dto.refreshToken) },
    });

    if (!stored || stored.isRevoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token відкликано або протермінований');
    }

    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Користувач неактивний');
    }

    // Rotate: revoke old token, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const payload = { sub: user.id, role: user.role };
    const refreshTtlSec = Number(process.env.JWT_REFRESH_TTL_SEC ?? 2592000);
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
    });
    const newRefreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: refreshTtlSec },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + refreshTtlSec * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? 900),
    };
  }

  async logout(dto: RefreshTokenDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(dto.refreshToken) },
    });

    if (stored && !stored.isRevoked) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { isRevoked: true },
      });
    }

    return { success: true };
  }
}
