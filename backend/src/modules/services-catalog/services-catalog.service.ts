import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters?: { search?: string; status?: string }, pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where: Prisma.ServiceTypeWhereInput = {};

    if (filters?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters?.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (filters?.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { prefix: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.serviceType.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.serviceType.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }

  async create(dto: CreateServiceDto) {
    const code = dto.code?.trim().toUpperCase() ?? `${dto.prefix.trim().toUpperCase()}_${Date.now()}`;
    const service = await this.prisma.serviceType.create({
      data: {
        code,
        name: dto.name.trim(),
        prefix: dto.prefix.trim().toUpperCase(),
        slaMinutes: dto.slaMinutes,
      },
    });
    return { service };
  }

  async update(serviceId: string, dto: UpdateServiceDto) {
    await this.ensureServiceExists(serviceId);

    const service = await this.prisma.serviceType.update({
      where: { id: serviceId },
      data: {
        name: dto.name?.trim(),
        prefix: dto.prefix?.trim().toUpperCase(),
        code: dto.code?.trim().toUpperCase(),
        slaMinutes: dto.slaMinutes,
        isActive: dto.isActive,
      },
    });

    return { service };
  }

  async delete(serviceId: string) {
    await this.ensureServiceExists(serviceId);
    await this.prisma.serviceType.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
    return { success: true };
  }

  async usage(serviceId: string) {
    const service = await this.prisma.serviceType.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        code: true,
        name: true,
        prefix: true,
        slaMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Послугу не знайдено');
    }

    const [workplaceBindings, operatorBindings] = await Promise.all([
      this.prisma.workplaceServiceType.findMany({
        where: { serviceTypeId: serviceId },
        select: {
          workplace: {
            select: {
              id: true,
              name: true,
              isActive: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                  district: {
                    select: {
                      id: true,
                      name: true,
                      city: {
                        select: {
                          id: true,
                          name: true,
                          country: {
                            select: {
                              id: true,
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.userServiceAccess.findMany({
        where: { serviceTypeId: serviceId },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    return {
      service,
      workplaces: workplaceBindings.map((binding) => ({
        id: binding.workplace.id,
        name: binding.workplace.name,
        isActive: binding.workplace.isActive,
        branchId: binding.workplace.branch.id,
        branchName: binding.workplace.branch.name,
        districtId: binding.workplace.branch.district.id,
        districtName: binding.workplace.branch.district.name,
        cityId: binding.workplace.branch.district.city.id,
        cityName: binding.workplace.branch.district.city.name,
        countryId: binding.workplace.branch.district.city.country.id,
        countryName: binding.workplace.branch.district.city.country.name,
      })),
      operators: operatorBindings.map((binding) => ({
        id: binding.user.id,
        fullName: binding.user.fullName,
        email: binding.user.email,
        role: binding.user.role,
        isActive: binding.user.isActive,
      })),
    };
  }

  async myAvailable(userId: string, pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where = {
      isActive: true,
      userAccess: {
        some: { userId },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.serviceType.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceType.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }

  async availableForBranch(branchId: string, pagination?: PaginationQuery) {
    const exists = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException('Відділення не знайдено');
    }

    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where = {
      isActive: true,
      workplaceServices: {
        some: {
          workplace: {
            branchId,
            isActive: true,
          },
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.serviceType.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.serviceType.count({ where }),
    ]);

    return { data: items, total, page, limit };
  }

  private async ensureServiceExists(serviceId: string): Promise<void> {
    const service = await this.prisma.serviceType.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException('Послугу не знайдено');
    }
  }
}
