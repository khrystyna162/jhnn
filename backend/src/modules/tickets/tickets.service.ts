import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { maskPhone } from '../../common/utils/phone.util';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import { type AuditLogInput } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NextTicketDto } from './dto/next-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    scope?: 'operator' | 'admin',
    userId?: string,
    pagination?: PaginationQuery,
    filters?: { status?: string; branchId?: string },
  ) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const scopeWhere =
      scope === 'operator' && userId
        ? {
            OR: [{ operatorId: userId }, { status: TicketStatus.WAITING }],
          }
        : undefined;

    const where: Record<string, unknown> = {
      ...(scopeWhere ?? {}),
      ...(filters?.branchId ? { branchId: filters.branchId } : {}),
    };

    if (filters?.status) {
      const normalizedStatus = filters.status.toUpperCase();
      if (Object.values(TicketStatus).includes(normalizedStatus as TicketStatus)) {
        where.status = normalizedStatus;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          currentService: true,
          branch: true,
          workplace: true,
          operator: true,
        },
      }),
      this.prisma.ticket.count({ where: Object.keys(where).length > 0 ? where : undefined }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
    };
  }

  async create(dto: CreateTicketDto, actorId?: string) {
    const [branch, service] = await Promise.all([
      this.prisma.branch.findUnique({ where: { id: dto.branchId } }),
      this.prisma.serviceType.findUnique({ where: { id: dto.serviceTypeId } }),
    ]);

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Відділення не знайдено або неактивне');
    }
    if (!service || !service.isActive) {
      throw new NotFoundException('Послугу не знайдено або неактивна');
    }

    const duplicate = await this.prisma.ticket.findFirst({
      where: {
        branchId: dto.branchId,
        phone: dto.phone,
        status: {
          in: [TicketStatus.WAITING, TicketStatus.CALLED, TicketStatus.IN_PROGRESS],
        },
      },
      select: { id: true, number: true },
    });

    if (duplicate) {
      throw new BadRequestException(
        `Для цього телефону вже є активний талон: ${duplicate.number}`,
      );
    }

    const phoneMasked = maskPhone(dto.phone);
    const ticketDateKey = this.getTicketDateKey();

    let ticket: Awaited<ReturnType<typeof this.prisma.ticket.create>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const number = await this.generateTicketNumber(service.prefix, dto.branchId, ticketDateKey);
      try {
        ticket = await this.prisma.ticket.create({
          data: {
            number,
            ticketDateKey,
            branchId: dto.branchId,
            serviceTypeId: dto.serviceTypeId,
            phone: dto.phone,
            phoneMasked,
            clientName: dto.clientName,
            status: TicketStatus.WAITING,
          },
        });
        break;
      } catch (error) {
        lastError = error;
        if ((error as { code?: string })?.code !== 'P2002') {
          throw error;
        }
      }
    }

    if (!ticket) {
      throw lastError;
    }

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'CREATED',
        toStatus: TicketStatus.WAITING,
      },
    });

    await this.safeAudit({
      actorId,
      action: 'TICKET_CREATED',
      entityType: 'TICKET',
      entityId: ticket.id,
      meta: {
        number: ticket.number,
        branchId: dto.branchId,
        serviceTypeId: dto.serviceTypeId,
      },
    });

    let notificationResult: unknown = null;
    try {
      notificationResult = await this.notificationsService.sendTicketNotifications(ticket.id, 'TICKET_CREATED');
    } catch (error) {
      notificationResult = {
        success: false,
        error: (error as Error).message,
      };
    }

    return {
      ticket,
      notification: notificationResult,
    };
  }

  async current(userId?: string) {
    const operatorId = this.requireUserId(userId);
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        operatorId,
        status: {
          in: [TicketStatus.CALLED, TicketStatus.IN_PROGRESS],
        },
      },
      orderBy: { calledAt: 'desc' },
    });

    return {
      ticket,
    };
  }

  async next(userId: string | undefined, dto?: NextTicketDto) {
    const operatorId = this.requireUserId(userId);
    const shift = await this.prisma.operatorShift.findFirst({
      where: {
        userId: operatorId,
        status: 'OPEN',
      },
      include: {
        workplace: {
          include: {
            workplaceServices: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!shift) {
      throw new BadRequestException('Спершу відкрийте зміну на робочому місці');
    }

    const operatorServiceAccess = await this.prisma.userServiceAccess.findMany({
      where: { userId: operatorId },
      select: { serviceTypeId: true },
    });

    const workplaceServiceIds = shift.workplace.workplaceServices.map((x) => x.serviceTypeId);
    const userServiceIds = new Set(operatorServiceAccess.map((x) => x.serviceTypeId));

    let allowedServiceIds = workplaceServiceIds.filter((serviceId) => userServiceIds.has(serviceId));
    if (allowedServiceIds.length === 0) {
      allowedServiceIds = workplaceServiceIds;
    }

    if (dto?.serviceId) {
      allowedServiceIds = allowedServiceIds.filter((serviceId) => serviceId === dto.serviceId);
    }

    if (allowedServiceIds.length === 0) {
      throw new BadRequestException('Немає дозволених послуг для виклику наступного талона');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: {
        branchId: shift.workplace.branchId,
        serviceTypeId: { in: allowedServiceIds },
        status: TicketStatus.WAITING,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!ticket) {
      return { ticket: null, message: 'У черзі немає талонів' };
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.CALLED,
        operatorId,
        workplaceId: shift.workplaceId,
        calledAt: new Date(),
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: updated.id,
        actorId: operatorId,
        eventType: 'CALLED',
        fromStatus: TicketStatus.WAITING,
        toStatus: TicketStatus.CALLED,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_CALLED',
      entityType: 'TICKET',
      entityId: updated.id,
      meta: {
        workplaceId: shift.workplaceId,
      },
    });

    let notificationResult: unknown = null;
    try {
      notificationResult = await this.notificationsService.sendTicketNotifications(updated.id, 'TICKET_CALLED');
    } catch (error) {
      notificationResult = {
        success: false,
        error: (error as Error).message,
      };
    }

    return {
      ticket: updated,
      notification: notificationResult,
    };
  }

  async callSpecific(ticketId: string, userId?: string) {
    const operatorId = this.requireUserId(userId);

    const shift = await this.prisma.operatorShift.findFirst({
      where: {
        userId: operatorId,
        status: 'OPEN',
      },
      include: {
        workplace: {
          include: {
            workplaceServices: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!shift) {
      throw new BadRequestException('Спершу відкрийте зміну на робочому місці');
    }

    const target = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!target) {
      throw new NotFoundException('Талон не знайдено');
    }

    if (target.status !== TicketStatus.WAITING) {
      throw new BadRequestException('Можна викликати лише талон у статусі WAITING');
    }

    if (target.branchId !== shift.workplace.branchId) {
      throw new BadRequestException('Талон належить до іншого відділення');
    }

    const operatorServiceAccess = await this.prisma.userServiceAccess.findMany({
      where: { userId: operatorId },
      select: { serviceTypeId: true },
    });

    const workplaceServiceIds = shift.workplace.workplaceServices.map((x) => x.serviceTypeId);
    const userServiceIds = new Set(operatorServiceAccess.map((x) => x.serviceTypeId));

    let allowedServiceIds = workplaceServiceIds.filter((serviceId) => userServiceIds.has(serviceId));
    if (allowedServiceIds.length === 0) {
      allowedServiceIds = workplaceServiceIds;
    }

    if (!allowedServiceIds.includes(target.serviceTypeId)) {
      throw new BadRequestException('Немає доступу до послуги цього талона');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: target.id },
      data: {
        status: TicketStatus.CALLED,
        operatorId,
        workplaceId: shift.workplaceId,
        calledAt: new Date(),
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId: updated.id,
        actorId: operatorId,
        eventType: 'CALLED',
        fromStatus: TicketStatus.WAITING,
        toStatus: TicketStatus.CALLED,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_CALLED',
      entityType: 'TICKET',
      entityId: updated.id,
      meta: {
        workplaceId: shift.workplaceId,
        specific: true,
      },
    });

    let notificationResult: unknown = null;
    try {
      notificationResult = await this.notificationsService.sendTicketNotifications(updated.id, 'TICKET_CALLED');
    } catch (error) {
      notificationResult = {
        success: false,
        error: (error as Error).message,
      };
    }

    return {
      ticket: updated,
      notification: notificationResult,
    };
  }

  async details(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        branch: true,
        currentService: true,
        workplace: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Талон не знайдено');
    }

    return {
      ticket,
    };
  }

  async events(ticketId: string, pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 200,
    });

    const where = { ticketId };

    const [events, total] = await Promise.all([
      this.prisma.ticketEvent.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.ticketEvent.count({ where }),
    ]);

    return {
      data: events,
      total,
      page,
      limit,
    };
  }

  async start(ticketId: string, userId?: string) {
    const operatorId = this.requireUserId(userId);
    const ticket = await this.ensureTicketOwnedByOperator(ticketId, operatorId);
    if (ticket.status !== TicketStatus.CALLED) {
      throw new BadRequestException('Почати можна тільки талон у статусі CALLED');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: operatorId,
        eventType: 'STARTED',
        fromStatus: TicketStatus.CALLED,
        toStatus: TicketStatus.IN_PROGRESS,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_STARTED',
      entityType: 'TICKET',
      entityId: ticketId,
    });

    return {
      ticket: updated,
    };
  }

  async complete(ticketId: string, userId?: string) {
    const operatorId = this.requireUserId(userId);
    const ticket = await this.ensureTicketOwnedByOperator(ticketId, operatorId);
    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      throw new BadRequestException('Завершити можна тільки талон у статусі IN_PROGRESS');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: operatorId,
        eventType: 'COMPLETED',
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.COMPLETED,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_COMPLETED',
      entityType: 'TICKET',
      entityId: ticketId,
    });

    return {
      ticket: updated,
    };
  }

  async cancel(ticketId: string, reason: string, userId?: string) {
    const operatorId = this.requireUserId(userId);
    const ticket = await this.ensureTicketOwnedByOperator(ticketId, operatorId, true);
    const activeStatuses: TicketStatus[] = [
      TicketStatus.WAITING,
      TicketStatus.CALLED,
      TicketStatus.IN_PROGRESS,
    ];

    if (!activeStatuses.includes(ticket.status)) {
      throw new BadRequestException('Скасувати можна тільки активний талон');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: operatorId,
        eventType: 'CANCELLED',
        fromStatus: ticket.status,
        toStatus: TicketStatus.CANCELLED,
        reason,
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_CANCELLED',
      entityType: 'TICKET',
      entityId: ticketId,
      meta: {
        reason,
      },
    });

    return {
      ticket: updated,
    };
  }

  async redirect(ticketId: string, targetServiceTypeId: string, reason: string, userId?: string) {
    const operatorId = this.requireUserId(userId);
    const ticket = await this.ensureTicketOwnedByOperator(ticketId, operatorId, true);
    const activeStatuses: TicketStatus[] = [
      TicketStatus.WAITING,
      TicketStatus.CALLED,
      TicketStatus.IN_PROGRESS,
    ];

    if (!activeStatuses.includes(ticket.status)) {
      throw new BadRequestException('Перенаправити можна тільки активний талон');
    }

    const targetService = await this.prisma.serviceType.findUnique({
      where: { id: targetServiceTypeId },
      select: { id: true, isActive: true },
    });
    if (!targetService || !targetService.isActive) {
      throw new NotFoundException('Цільову послугу не знайдено або неактивна');
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.REDIRECTED,
        targetServiceTypeId,
        redirectReason: reason,
      },
    });

    await this.prisma.ticketEvent.create({
      data: {
        ticketId,
        actorId: operatorId,
        eventType: 'REDIRECTED',
        fromStatus: ticket.status,
        toStatus: TicketStatus.REDIRECTED,
        reason,
        meta: {
          targetServiceTypeId,
        },
      },
    });

    await this.safeAudit({
      actorId: operatorId,
      action: 'TICKET_REDIRECTED',
      entityType: 'TICKET',
      entityId: ticketId,
      meta: {
        reason,
        targetServiceTypeId,
      },
    });

    return {
      ticket: updated,
    };
  }

  private requireUserId(userId?: string): string {
    if (!userId) {
      throw new UnauthorizedException('Користувача неавтентифіковано');
    }
    return userId;
  }

  private async ensureTicketOwnedByOperator(
    ticketId: string,
    operatorId: string,
    allowWaiting = false,
  ) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Талон не знайдено');
    }

    if (!allowWaiting && ticket.operatorId !== operatorId) {
      throw new UnauthorizedException('Цей талон призначено іншому оператору');
    }
    if (allowWaiting && ticket.operatorId && ticket.operatorId !== operatorId) {
      throw new UnauthorizedException('Цей талон призначено іншому оператору');
    }

    return ticket;
  }

  private getTicketDateKey(date = new Date()): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Kyiv',
    }).format(date);
  }

  private async generateTicketNumber(rawPrefix: string, branchId: string, ticketDateKey: string) {
    const prefix = rawPrefix.trim().toUpperCase();

    const dailyBranchTickets = await this.prisma.ticket.findMany({
      where: {
        branchId,
        ticketDateKey,
        number: {
          startsWith: prefix,
        },
      },
      select: { number: true },
    });

    if (dailyBranchTickets.length === 0) {
      return `${prefix}1`;
    }

    const maxNumber = dailyBranchTickets.reduce((max, ticket) => {
      if (!ticket.number.startsWith(prefix)) {
        return max;
      }

      const suffix = ticket.number.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) {
        return max;
      }

      const current = Number(suffix);
      return current > max ? current : max;
    }, 0);

    return `${prefix}${maxNumber + 1}`;
  }

  private async safeAudit(input: AuditLogInput) {
    try {
      await this.auditService.logAction(input);
    } catch {
      // Ignore audit persistence issues; queue operations must remain available.
    }
  }
}
