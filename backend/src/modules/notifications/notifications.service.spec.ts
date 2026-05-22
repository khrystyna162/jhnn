import { DeliveryStatus, NotificationChannel } from '@prisma/client';

import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notificationTemplate: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(prisma);
  });

  it('paginates listTemplates()', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([{ code: 'TICKET_CREATED' }]);
    prisma.notificationTemplate.count.mockResolvedValue(6);

    const result = await service.listTemplates({ page: '2', limit: '3' });

    expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 3,
        take: 3,
      }),
    );
    expect(result).toEqual({
      data: [{ code: 'TICKET_CREATED' }],
      total: 6,
      page: 2,
      limit: 3,
    });
  });

  it('paginates deliveryLog()', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
    prisma.notification.count.mockResolvedValue(4);

    const result = await service.deliveryLog({ page: '1', limit: '2' });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'n1' }],
      total: 4,
      page: 1,
      limit: 2,
    });
  });

  it('deletes notification template by id', async () => {
    prisma.notificationTemplate.delete.mockResolvedValue({ id: 'tpl-1' });

    const result = await service.deleteTemplate('tpl-1');

    expect(prisma.notificationTemplate.delete).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
    });
    expect(result).toEqual({ success: true });
  });

  it('uses SMS fallback when Viber fails in mock mode', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({ value: { mode: 'mock' } });
    prisma.ticket.findUnique.mockResolvedValue({
      id: 't1',
      number: 'A1',
      phone: '+380501112230',
      branch: { name: 'Branch A' },
      currentService: { name: 'Service A' },
    });
    prisma.notificationTemplate.findFirst
      .mockResolvedValueOnce({
        id: 'tpl-viber',
        code: 'TICKET_CREATED',
        channel: NotificationChannel.VIBER,
        text: 'Ticket {{ticketNumber}}',
        version: 1,
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: 'tpl-sms',
        code: 'TICKET_CREATED',
        channel: NotificationChannel.SMS,
        text: 'SMS {{ticketNumber}}',
        version: 1,
        isActive: true,
      });
    prisma.notification.create.mockResolvedValue({});

    const result = await service.sendTicketNotifications('t1', 'TICKET_CREATED');

    expect(result).toEqual({ success: true, primary: 'VIBER', fallbackUsed: true });
    expect(prisma.notification.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannel.VIBER,
          status: DeliveryStatus.FAILED,
        }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          channel: NotificationChannel.SMS,
          status: DeliveryStatus.SENT,
        }),
      }),
    );
  });

  it('returns failure when viber fails and sms template missing', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({ value: { mode: 'mock' } });
    prisma.ticket.findUnique.mockResolvedValue({
      id: 't2',
      number: 'A2',
      phone: '+380501112230',
      branch: { name: 'Branch A' },
      currentService: { name: 'Service A' },
    });
    prisma.notificationTemplate.findFirst
      .mockResolvedValueOnce({
        id: 'tpl-viber',
        code: 'TICKET_CREATED',
        channel: NotificationChannel.VIBER,
        text: 'Ticket {{ticketNumber}}',
        version: 1,
        isActive: true,
      })
      .mockResolvedValueOnce(null);
    prisma.notification.create.mockResolvedValue({});

    const result = await service.sendTicketNotifications('t2', 'TICKET_CREATED');

    expect(result).toEqual({
      success: false,
      primary: 'VIBER',
      fallbackUsed: false,
      reason: 'SMS template missing',
    });
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  });
});
