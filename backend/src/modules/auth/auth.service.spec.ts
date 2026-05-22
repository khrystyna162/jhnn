import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma, jwtService);
    process.env.JWT_ACCESS_TTL_SEC = '900';
    process.env.JWT_REFRESH_TTL_SEC = '3600';
  });

  it('returns token pair on valid login', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.OPERATOR,
      fullName: 'User One',
      isActive: true,
      passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.login({ username: 'user@test', password: 'password123' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(prisma.user.findFirst).toHaveBeenCalled();
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('throws UnauthorizedException on invalid password', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.OPERATOR,
      fullName: 'User One',
      isActive: true,
      passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ username: 'user@test', password: 'badpass123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('locks account key after 5 failed attempts', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.OPERATOR,
      fullName: 'User One',
      isActive: true,
      passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    for (let i = 0; i < 5; i += 1) {
      await expect(
        service.login({ username: 'user@test', password: 'badpass123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    await expect(
      service.login({ username: 'user@test', password: 'badpass123' }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(5);
  });

  it('clears failed attempt counter after successful login', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: Role.OPERATOR,
      fullName: 'User One',
      isActive: true,
      passwordHash: 'hash',
    });
    (bcrypt.compare as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshToken.create.mockResolvedValue({});

    await expect(
      service.login({ username: 'user@test', password: 'bad-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ username: 'user@test', password: 'bad-2' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    await expect(
      service.login({ username: 'user@test', password: 'good' }),
    ).resolves.toMatchObject({ accessToken: 'access-token' });

    await expect(
      service.login({ username: 'user@test', password: 'bad-3' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(4);
  });

  it('rotates refresh tokens on refresh()', async () => {
    const refreshToken = 'refresh-token-old';
    const refreshedToken = 'refresh-token-new';
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      role: Role.OPERATOR,
      tokenType: 'refresh',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: Role.OPERATOR,
      isActive: true,
    });
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token-new')
      .mockResolvedValueOnce(refreshedToken);
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await service.refresh({ refreshToken });

    expect(result).toEqual({
      accessToken: 'access-token-new',
      refreshToken: refreshedToken,
      expiresIn: 900,
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { isRevoked: true },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('revokes refresh token on logout()', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      isRevoked: false,
    });
    prisma.refreshToken.update.mockResolvedValue({});

    const result = await service.logout({ refreshToken: 'refresh-token' });

    expect(result).toEqual({ success: true });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { isRevoked: true },
    });
  });
});
