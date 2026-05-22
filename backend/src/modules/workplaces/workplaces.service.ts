import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ShiftStatus, TicketStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { type AuditLogInput } from '../audit/audit.service';
import { StartShiftDto } from './dto/start-shift.dto';

@Injectable()
export class WorkplacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async myAvailable(userId?: string, pagination?: PaginationQuery) {
    const operatorId = this.requireUserId(userId);
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const userScopes = await this.prisma.userScope.findMany({
      where: { userId: operatorId },
      select: {
        level: true,
        countryId: true,
        cityId: true,
        districtId: true,
        branchId: true,
      },
    });

    const allScope = userScopes.some((scope) => scope.level === 'ALL');
    const branchIds = userScopes
      .map((scope) => scope.branchId)
      .filter((branchId): branchId is string => Boolean(branchId));

    const where = {
      isActive: true,
      status: 'ACTIVE' as const,
      branch: allScope
        ? { isActive: true }
        : branchIds.length > 0
          ? { id: { in: branchIds }, isActive: true }
          : undefined,
    };

    const [workplaces, total] = await Promise.all([
      this.prisma.workplace.findMany({
        where,
        include: {
          branch: true,
          workplaceServices: {
            include: {
              serviceType: true,
            },
          },
        },
        orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.workplace.count({ where }),
    ]);

    return {
      data: workplaces.map((workplace) => this.serializeWorkplace(workplace)),
      total,
      page,
      limit,
    };
  }

  async list(pagination?: PaginationQuery, branchId?: string) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 50,
      maxLimit: 200,
    });

    const where = branchId ? { branchId } : undefined;

    const [workplaces, total] = await Promise.all([
      this.prisma.workplace.findMany({
        where,
        include: {
          branch: true,
          workplaceServices: {
            include: {
              serviceType: true,
            },
          },
        },
        orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.workplace.count({ where }),
    ]);

    return {
      data: workplaces.map((workplace) => this.serializeWorkplace(workplace)),
      total,
      page,
      limit,
    };
  }

  async create(
    dto: { number: string; branchId: string; serviceId?: string; isActive?: boolean },
    actorId?: string,
  ) {
    const number = dto.number?.trim();
    if (!number) {
      throw new BadRequestException('Номер робочого місця обов\'язковий');
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch || !branch.isActive) {
      throw new NotFoundException('Філію не знайдено або вона неактивна');
    }

    if (dto.serviceId) {
      const service = await this.prisma.serviceType.findUnique({ where: { id: dto.serviceId } });
      if (!service || !service.isActive) {
        throw new NotFoundException('Послугу не знайдено або вона неактивна');
      }
    }

    const created = await this.prisma.workplace.create({
      data: {
        branchId: dto.branchId,
        name: number,
        isActive: dto.isActive ?? true,
      },
      include: {
        branch: true,
        workplaceServices: {
          include: {
            serviceType: true,
          },
        },
      },
    });

    if (dto.serviceId) {
      await this.prisma.workplaceServiceType.upsert({
        where: {
          workplaceId_serviceTypeId: {
            workplaceId: created.id,
            serviceTypeId: dto.serviceId,
          },
        },
        update: {},
        create: {
          workplaceId: created.id,
          serviceTypeId: dto.serviceId,
        },
      });
    }

    await this.safeAudit({
      actorId,
      action: 'WORKPLACE_CREATED',
      entityType: 'WORKPLACE',
      entityId: created.id,
      meta: {
        branchId: dto.branchId,
        serviceId: dto.serviceId,
      },
    });

    const full = await this.prisma.workplace.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        branch: true,
        workplaceServices: {
          include: {
            serviceType: true,
          },
        },
      },
    });

    return this.serializeWorkplace(full);
  }

  async update(
    workplaceId: string,
    dto: { number?: string; branchId?: string; serviceId?: string; isActive?: boolean },
    actorId?: string,
  ) {
    const current = await this.prisma.workplace.findUnique({
      where: { id: workplaceId },
      include: {
        workplaceServices: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Робоче місце не знайдено');
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || !branch.isActive) {
        throw new NotFoundException('Філію не знайдено або вона неактивна');
      }
    }

    if (dto.serviceId) {
      const service = await this.prisma.serviceType.findUnique({ where: { id: dto.serviceId } });
      if (!service || !service.isActive) {
        throw new NotFoundException('Послугу не знайдено або вона неактивна');
      }
    }

    await this.prisma.workplace.update({
      where: { id: workplaceId },
      data: {
        name: dto.number?.trim() || undefined,
        branchId: dto.branchId,
        isActive: dto.isActive,
      },
    });

    if (dto.serviceId) {
      await this.prisma.workplaceServiceType.deleteMany({
        where: { workplaceId },
      });

      await this.prisma.workplaceServiceType.create({
        data: {
          workplaceId,
          serviceTypeId: dto.serviceId,
        },
      });
    }

    await this.safeAudit({
      actorId,
      action: 'WORKPLACE_UPDATED',
      entityType: 'WORKPLACE',
      entityId: workplaceId,
      meta: {
        branchId: dto.branchId,
        serviceId: dto.serviceId,
      },
    });

    const updated = await this.prisma.workplace.findUniqueOrThrow({
      where: { id: workplaceId },
      include: {
        branch: true,
        workplaceServices: {
          include: {
            serviceType: true,
          },
        },
      },
    });

    return this.serializeWorkplace(updated);
  }

  async remove(workplaceId: string, actorId?: string) {
    const workplace = await this.prisma.workplace.findUnique({ where: { id: workplaceId } });
    if (!workplace) {
      throw new NotFoundException('Робоче місце не знайдено');
    }

    const activeTickets = await this.prisma.ticket.count({
      where: {
        workplaceId,
        status: {
          in: [TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_PROGRESS],
        },
      },
    });

    if (activeTickets > 0) {
      throw new BadRequestException('Неможливо видалити робоче місце з активними талонами');
    }

    await this.prisma.workplaceServiceType.deleteMany({ where: { workplaceId } });
    await this.prisma.workplace.delete({ where: { id: workplaceId } });

    await this.safeAudit({
      actorId,
      action: 'WORKPLACE_DELETED',
      entityType: 'WORKPLACE',
      entityId: workplaceId,
    });

    return { success: true };
  }

  async currentShift(userId?: string) {
    const operatorId = this.requireUserId(userId);

    const shift = await this.prisma.operatorShift.findFirst({
      where: {
        userId: operatorId,
        status: ShiftStatus.OPEN,
      },
      include: {
        workplace: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!shift) {
      return {
        shift: null,
      };
    }

    return {
      shift: {
        id: shift.id,
        userId: shift.userId,
        workplaceId: shift.workplaceId,
        status: shift.status,
        startedAt: shift.startedAt,
        endedAt: shift.endedAt,
      },
      workplace: {
        id: shift.workplace.id,
        number: shift.workplace.name,
      },
    };
  }

  async startShift(userId: string, dto: StartShiftDto) {
    const operatorId = this.requireUserId(userId);

    const [user, workplace] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: operatorId } }),
      this.prisma.workplace.findUnique({ where: { id: dto.workplaceId } }),
    ]);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Оператор не знайдений або неактивний');
    }
    if (user.role !== 'OPERATOR') {
      throw new BadRequestException('Зміну може відкривати тільки оператор');
    }
    if (!workplace || !workplace.isActive || workplace.status !== 'ACTIVE') {
      throw new NotFoundException('Робоче місце недоступне');
    }

    await this.prisma.operatorShift.updateMany({
      where: {
        userId: operatorId,
        status: ShiftStatus.OPEN,
      },
      data: {
        status: ShiftStatus.CLOSED,
        endedAt: new Date(),
      },
    });

    const shift = await this.prisma.operatorShift.create({
      data: {
        userId: operatorId,
        workplaceId: dto.workplaceId,
        status: ShiftStatus.OPEN,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'SHIFT_STARTED',
      entityType: 'OPERATOR_SHIFT',
      entityId: shift.id,
      meta: {
        workplaceId: dto.workplaceId,
      },
    });

    return {
      shift,
    };
  }

  async endShift(userId?: string) {
    const operatorId = this.requireUserId(userId);

    const openShifts = await this.prisma.operatorShift.findMany({
      where: {
        userId: operatorId,
        status: ShiftStatus.OPEN,
      },
      select: {
        id: true,
        workplace: {
          select: {
            branchId: true,
          },
        },
      },
    });

    if (openShifts.length === 0) {
      throw new BadRequestException('Активна зміна не знайдена');
    }

    const branchIds = Array.from(new Set(openShifts.map((shift) => shift.workplace.branchId)));
    const now = new Date();
    const activeStatuses: TicketStatus[] = [
      TicketStatus.WAITING,
      TicketStatus.CALLED,
      TicketStatus.IN_PROGRESS,
    ];
    const shiftEndReason = 'Не обслужено: кінець зміни';

    const activeTickets = await this.prisma.ticket.findMany({
      where: {
        branchId: { in: branchIds },
        status: { in: activeStatuses },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const closedShifts = await tx.operatorShift.updateMany({
        where: {
          userId: operatorId,
          status: ShiftStatus.OPEN,
        },
        data: {
          status: ShiftStatus.CLOSED,
          endedAt: now,
        },
      });

      if (activeTickets.length > 0) {
        await tx.ticket.updateMany({
          where: {
            id: { in: activeTickets.map((ticket) => ticket.id) },
            status: { in: activeStatuses },
          },
          data: {
            status: TicketStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: shiftEndReason,
          },
        });

        await tx.ticketEvent.createMany({
          data: activeTickets.map((ticket) => ({
            ticketId: ticket.id,
            actorId: operatorId,
            eventType: 'CANCELLED_BY_SHIFT_END',
            fromStatus: ticket.status,
            toStatus: TicketStatus.CANCELLED,
            reason: shiftEndReason,
          })),
        });
      }

      return {
        closedShifts: closedShifts.count,
        autoCancelledTickets: activeTickets.length,
      };
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'SHIFT_ENDED',
      entityType: 'OPERATOR_SHIFT',
      meta: {
        closed: result.closedShifts,
        autoCancelledTickets: result.autoCancelledTickets,
      },
    });

    return {
      success: true,
      closed: result.closedShifts,
      autoCancelledTickets: result.autoCancelledTickets,
    };
  }

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException('Передайте x-user-id у заголовку запиту');
    }
    return userId;
  }

  private async safeAudit(input: AuditLogInput) {
    try {
      await this.auditService.logAction(input);
    } catch {
      // Ignore audit write errors to keep queue operations available.
    }
  }

  private serializeWorkplace(
    workplace: {
      id: string;
      name: string;
      branchId: string;
      isActive: boolean;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      branch?: { name?: string | null } | null;
      workplaceServices?: Array<{ serviceTypeId: string; serviceType?: { name?: string | null } | null }>;
    },
  ) {
    const primaryService = workplace.workplaceServices?.[0];

    return {
      id: workplace.id,
      number: workplace.name,
      branchId: workplace.branchId,
      branchName: workplace.branch?.name ?? undefined,
      serviceId: primaryService?.serviceTypeId,
      serviceName: primaryService?.serviceType?.name ?? undefined,
      isActive: workplace.isActive,
      status: workplace.status,
      createdAt: workplace.createdAt,
      updatedAt: workplace.updatedAt,
    };
  }
}
