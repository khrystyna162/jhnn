import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, NotificationChannel } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { type PaginationQuery } from '../../common/types/pagination-query.type';
import { parsePaginationQuery } from '../../common/utils/pagination.util';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { TestSendDto } from './dto/test-send.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTicketStatus(ticketId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });

    const viber = rows.find((row) => row.channel === NotificationChannel.VIBER);
    const sms = rows.find((row) => row.channel === NotificationChannel.SMS);

    return {
      ticketId,
      viberStatus: viber?.status ?? DeliveryStatus.NOT_SENT,
      smsStatus: sms?.status ?? DeliveryStatus.NOT_SENT,
      details: rows,
    };
  }

  async listTemplates(pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 100,
    });

    const [items, total] = await Promise.all([
      this.prisma.notificationTemplate.findMany({
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.notificationTemplate.count(),
    ]);

    return { data: items, total, page, limit };
  }

  async createTemplate(dto: CreateNotificationTemplateDto) {
    const existingLast = await this.prisma.notificationTemplate.findFirst({
      where: {
        code: dto.code,
        channel: dto.channel,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const template = await this.prisma.notificationTemplate.create({
      data: {
        code: dto.code,
        channel: dto.channel,
        text: dto.text,
        version: (existingLast?.version ?? 0) + 1,
        isActive: true,
      },
    });

    return { template };
  }

  async updateTemplate(templateId: string, dto: UpdateNotificationTemplateDto) {
    const template = await this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: {
        text: dto.text,
        isActive: dto.isActive,
      },
    });

    return { template };
  }

  async deliveryLog(pagination?: PaginationQuery) {
    const { page, limit, skip } = parsePaginationQuery(pagination, {
      defaultPage: 1,
      defaultLimit: 20,
      maxLimit: 200,
    });

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          ticket: {
            select: {
              number: true,
            },
          },
        },
      }),
      this.prisma.notification.count(),
    ]);

    return { data: items, total, page, limit };
  }

  async testSend(templateId: string, dto: TestSendDto) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template || !template.isActive) {
      throw new NotFoundException('Шаблон не знайдено або неактивний');
    }

    const message = this.renderTemplate(template.text, {
      ticketNumber: 'TEST1',
      serviceName: 'Тестова послуга',
      branchName: 'Тестове відділення',
      expectedTime: '12:00',
    });

    const result = await this.sendByChannel(template.channel, dto.phone, message);

    return {
      success: true,
      channel: template.channel,
      renderedMessage: message,
      result,
    };
  }

  async sendTicketNotifications(ticketId: string, templateCode = 'TICKET_CREATED') {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        branch: true,
        currentService: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Талон не знайдено');
    }

    const viberTemplate = await this.getActiveTemplate(templateCode, NotificationChannel.VIBER);
    const smsTemplate = await this.getActiveTemplate(templateCode, NotificationChannel.SMS);

    if (!viberTemplate && !smsTemplate) {
      return {
        success: false,
        reason: `Немає активних шаблонів для коду ${templateCode}`,
      };
    }

    const payload = {
      ticketNumber: ticket.number,
      serviceName: ticket.currentService.name,
      branchName: ticket.branch.name,
      expectedTime: '-',
    };

    if (viberTemplate) {
      const message = this.renderTemplate(viberTemplate.text, payload);
      const sendResult = await this.sendByChannel(NotificationChannel.VIBER, ticket.phone, message);
      await this.prisma.notification.create({
        data: {
          ticketId,
          channel: NotificationChannel.VIBER,
          status: sendResult.ok ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
          providerName: sendResult.provider,
          templateCode: viberTemplate.code,
          errorMessage: sendResult.ok ? null : sendResult.error,
          sentAt: sendResult.ok ? new Date() : null,
        },
      });

      if (sendResult.ok) {
        return { success: true, primary: 'VIBER', fallbackUsed: false };
      }
    }

    if (!smsTemplate) {
      return { success: false, primary: 'VIBER', fallbackUsed: false, reason: 'SMS template missing' };
    }

    const smsMessage = this.renderTemplate(smsTemplate.text, payload);
    const smsResult = await this.sendByChannel(NotificationChannel.SMS, ticket.phone, smsMessage);
    await this.prisma.notification.create({
      data: {
        ticketId,
        channel: NotificationChannel.SMS,
        status: smsResult.ok ? DeliveryStatus.SENT : DeliveryStatus.FAILED,
        providerName: smsResult.provider,
        templateCode: smsTemplate.code,
        errorMessage: smsResult.ok ? null : smsResult.error,
        sentAt: smsResult.ok ? new Date() : null,
      },
    });

    return { success: smsResult.ok, primary: 'VIBER', fallbackUsed: true };
  }

  async deleteTemplate(templateId: string): Promise<{ success: boolean }> {
    await this.prisma.notificationTemplate.delete({ where: { id: templateId } });
    return { success: true };
  }

  private async getActiveTemplate(code: string, channel: NotificationChannel) {
    return this.prisma.notificationTemplate.findFirst({
      where: {
        code,
        channel,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });
  }

  private renderTemplate(template: string, vars: Record<string, string>) {
    return template
      .replaceAll('{{ticketNumber}}', vars.ticketNumber)
      .replaceAll('{{serviceName}}', vars.serviceName)
      .replaceAll('{{branchName}}', vars.branchName)
      .replaceAll('{{expectedTime}}', vars.expectedTime);
  }

  private async sendByChannel(channel: NotificationChannel, phone: string, message: string) {
    const providerMode = await this.getProviderMode();

    if (providerMode === 'mock') {
      if (channel === NotificationChannel.VIBER && phone.replace(/\D/g, '').endsWith('0')) {
        return {
          ok: false,
          provider: 'mock',
          error: 'Viber mock failure for test fallback',
        };
      }
      return { ok: true, provider: 'mock' };
    }

    if (providerMode === 'sandbox') {
      return { ok: true, provider: 'sandbox' };
    }

    // Production placeholder, to be replaced with real provider integrations.
    return {
      ok: false,
      provider: 'production-placeholder',
      error: `Provider integration not implemented for ${channel}. Message: ${message}`,
    };
  }

  private async getProviderMode(): Promise<'mock' | 'sandbox' | 'production'> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: 'notification_provider_mode' },
      select: { value: true },
    });

    if (!row || typeof row.value !== 'object' || row.value === null) {
      return 'mock';
    }

    const mode = (row.value as { mode?: string }).mode;
    if (mode === 'sandbox' || mode === 'production' || mode === 'mock') {
      return mode;
    }
    return 'mock';
  }
}
