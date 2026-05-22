import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { AuditQueryDto } from './dto/audit-query.dto';

export type AuditLogInput = {
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async list(query: AuditQueryDto) {
    const { page, limit, skip } = parsePaginationQuery(query, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorId: query.actorId,
      entityType: query.entityType,
      entityId: query.entityId,
      createdAt:
        from || to
          ? {
              gte: from,
              lte: to,
            }
          : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
    };
  }

  async byEntity(entityType: string, entityId: string, limit = 50) {
    const take = Math.min(200, Math.max(1, limit));

    const items = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return {
      data: items,
      total: items.length,
    };
  }
}
