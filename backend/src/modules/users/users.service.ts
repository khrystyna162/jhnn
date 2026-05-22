import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { type AuditLogInput } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    role?: string,
    filters?: { search?: string; status?: string },
    pagination?: PaginationQuery,
  ) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as Role;
    }

    if (filters?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters?.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (filters?.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
    };
  }

  async create(dto: CreateUserDto, actorId?: string) {
    const rawPassword = dto.password ?? UsersService.generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        role: dto.role as Role,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    await this.safeAudit({
      actorId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      meta: {
        role: user.role,
      },
    });

    return {
      user,
      generatedPassword: dto.password ? null : rawPassword,
    };
  }

  async update(userId: string, dto: UpdateUserDto, actorId?: string) {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    await this.safeAudit({
      actorId,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: userId,
      meta: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        isActive: dto.isActive,
      },
    });

    return {
      user,
    };
  }

  async deactivate(userId: string, actorId?: string) {
    await this.ensureUserExists(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await this.safeAudit({
      actorId,
      action: 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: userId,
    });

    return {
      success: true,
    };
  }

  async resetPassword(userId: string, actorId?: string) {
    await this.ensureUserExists(userId);

    const newPassword = UsersService.generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.safeAudit({
      actorId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'USER',
      entityId: userId,
    });

    return {
      success: true,
      newPassword,
    };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
  }

  private static generatePassword(): string {
    return `SoftTurn${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private async safeAudit(input: AuditLogInput) {
    try {
      await this.auditService.logAction(input);
    } catch {
      // Audit failure must not block primary user management operations.
    }
  }
}
