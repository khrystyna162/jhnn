import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { UpdateUserScopesDto } from './dto/update-user-scopes.dto';
import { UpdateUserServiceAccessDto } from './dto/update-user-service-access.dto';

@Injectable()
export class RolesPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions(pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const [items, total] = await Promise.all([
      this.prisma.permission.findMany({
        orderBy: { code: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.permission.count(),
    ]);

    return { data: items, total, page, limit };
  }

  async getUserAccess(userId: string) {
    await this.ensureUser(userId);

    const [permissions, scopes, serviceAccess] = await Promise.all([
      this.prisma.userPermission.findMany({
        where: { userId },
        select: {
          permission: {
            select: {
              code: true,
            },
          },
        },
      }),
      this.prisma.userScope.findMany({
        where: { userId },
        select: {
          level: true,
          countryId: true,
          cityId: true,
          districtId: true,
          branchId: true,
        },
      }),
      this.prisma.userServiceAccess.findMany({
        where: { userId },
        select: { serviceTypeId: true },
      }),
    ]);

    return {
      permissions: permissions.map((item) => item.permission.code),
      scopes,
      serviceIds: serviceAccess.map((item) => item.serviceTypeId),
    };
  }

  async updateUserPermissions(userId: string, dto: UpdateUserPermissionsDto) {
    await this.ensureUser(userId);

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissions } },
      select: { id: true },
    });

    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId } }),
      this.prisma.userPermission.createMany({
        data: permissions.map((permission) => ({ userId, permissionId: permission.id })),
        skipDuplicates: true,
      }),
    ]);

    return { success: true, assigned: permissions.length };
  }

  async updateUserScopes(userId: string, dto: UpdateUserScopesDto) {
    await this.ensureUser(userId);

    await this.prisma.$transaction([
      this.prisma.userScope.deleteMany({ where: { userId } }),
      this.prisma.userScope.createMany({
        data: dto.scopes.map((scope) => ({
          userId,
          level: scope.level,
          countryId: scope.countryId,
          cityId: scope.cityId,
          districtId: scope.districtId,
          branchId: scope.branchId,
        })),
      }),
    ]);

    return { success: true, assigned: dto.scopes.length };
  }

  async updateUserServiceAccess(userId: string, dto: UpdateUserServiceAccessDto) {
    await this.ensureUser(userId);

    await this.prisma.$transaction([
      this.prisma.userServiceAccess.deleteMany({ where: { userId } }),
      this.prisma.userServiceAccess.createMany({
        data: dto.serviceIds.map((serviceTypeId) => ({ userId, serviceTypeId })),
        skipDuplicates: true,
      }),
    ]);

    return { success: true, assigned: dto.serviceIds.length };
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
  }
}
