import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

type AnalyticsFilter = {
  from?: string;
  to?: string;
  branchId?: string;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async kpiSummary(filter: AnalyticsFilter) {
    const completedTickets = await this.prisma.ticket.findMany({
      where: this.buildCompletedWhere(filter),
      select: {
        startedAt: true,
        completedAt: true,
        createdAt: true,
        operatorId: true,
      },
    });

    const waitTimes: number[] = [];
    const serviceTimes: number[] = [];
    const perOperator = new Map<string, number[]>();

    for (const ticket of completedTickets) {
      if (ticket.startedAt) {
        waitTimes.push((ticket.startedAt.getTime() - ticket.createdAt.getTime()) / 1000);
      }
      if (ticket.startedAt && ticket.completedAt) {
        const service = (ticket.completedAt.getTime() - ticket.startedAt.getTime()) / 1000;
        serviceTimes.push(service);
        if (ticket.operatorId) {
          const current = perOperator.get(ticket.operatorId) ?? [];
          current.push(service);
          perOperator.set(ticket.operatorId, current);
        }
      }
    }

    const avgWaitingSec = this.avg(waitTimes);
    const avgServiceSec = this.avg(serviceTimes);
    const minServiceSec = serviceTimes.length ? Math.min(...serviceTimes) : 0;
    const maxServiceSec = serviceTimes.length ? Math.max(...serviceTimes) : 0;

    const ratings = Array.from(perOperator.entries()).map(([operatorId, values]) => ({
      operatorId,
      avgServiceSec: this.avg(values),
    }));

    ratings.sort((a, b) => a.avgServiceSec - b.avgServiceSec);

    return {
      avgWaitingSec,
      avgServiceSec,
      minServiceSec,
      maxServiceSec,
      bestOperator: ratings[0] ?? null,
      worstOperator: ratings[ratings.length - 1] ?? null,
      completedCount: completedTickets.length,
    };
  }

  async dashboard(filter: AnalyticsFilter) {
    const where = this.buildWhere(filter);

    const [waitingNow, inProgressNow, completedToday] = await Promise.all([
      this.prisma.ticket.count({ where: { ...where, status: 'WAITING' } }),
      this.prisma.ticket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      this.prisma.ticket.count({
        where: {
          ...where,
          status: 'COMPLETED',
          completedAt: {
            gte: this.startOfDay(),
            lte: this.endOfDay(),
          },
        },
      }),
    ]);

    const kpi = await this.kpiSummary(filter);

    return {
      waitingNow,
      inProgressNow,
      completedToday,
      avgWaitingSec: kpi.avgWaitingSec,
      avgServiceSec: kpi.avgServiceSec,
      bestOperator: kpi.bestOperator,
      worstOperator: kpi.worstOperator,
    };
  }

  async waitingTime(filter: AnalyticsFilter) {
    const completedTickets = await this.prisma.ticket.findMany({
      where: this.buildCompletedWhere(filter),
      select: {
        id: true,
        number: true,
        createdAt: true,
        startedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return {
      items: completedTickets
        .filter((ticket) => Boolean(ticket.startedAt))
        .map((ticket) => ({
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          waitingSec: ticket.startedAt
            ? Math.round((ticket.startedAt.getTime() - ticket.createdAt.getTime()) / 1000)
            : null,
        })),
    };
  }

  async serviceTime(filter: AnalyticsFilter) {
    const completedTickets = await this.prisma.ticket.findMany({
      where: this.buildCompletedWhere(filter),
      select: {
        id: true,
        number: true,
        startedAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return {
      items: completedTickets
        .filter((ticket) => Boolean(ticket.startedAt && ticket.completedAt))
        .map((ticket) => ({
          ticketId: ticket.id,
          ticketNumber: ticket.number,
          serviceSec:
            ticket.startedAt && ticket.completedAt
              ? Math.round((ticket.completedAt.getTime() - ticket.startedAt.getTime()) / 1000)
              : null,
        })),
    };
  }

  async operatorsRating(filter: AnalyticsFilter) {
    const completedTickets = await this.prisma.ticket.findMany({
      where: this.buildCompletedWhere(filter),
      select: {
        operatorId: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const perOperator = new Map<string, number[]>();

    for (const ticket of completedTickets) {
      if (!ticket.operatorId || !ticket.startedAt || !ticket.completedAt) {
        continue;
      }
      const sec = (ticket.completedAt.getTime() - ticket.startedAt.getTime()) / 1000;
      const current = perOperator.get(ticket.operatorId) ?? [];
      current.push(sec);
      perOperator.set(ticket.operatorId, current);
    }

    const items = Array.from(perOperator.entries())
      .map(([operatorId, values]) => ({
        operatorId,
        avgServiceSec: this.avg(values),
      }))
      .sort((a, b) => a.avgServiceSec - b.avgServiceSec);

    return { items };
  }

  async export(filter: AnalyticsFilter) {
    const kpi = await this.kpiSummary(filter);
    return {
      format: 'json',
      generatedAt: new Date().toISOString(),
      filter,
      kpi,
    };
  }

  private buildWhere(filter: AnalyticsFilter) {
    const where: Record<string, unknown> = {};

    if (filter.branchId) {
      where.branchId = filter.branchId;
    }

    return where;
  }

  private buildCompletedWhere(filter: AnalyticsFilter) {
    const where = this.buildWhere(filter) as Record<string, unknown>;
    where.status = 'COMPLETED';

    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;

    if (from || to) {
      where.completedAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    return where;
  }

  private avg(values: number[]) {
    if (!values.length) {
      return 0;
    }
    const sum = values.reduce((acc, value) => acc + value, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  private startOfDay() {
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay() {
    const now = new Date();
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
