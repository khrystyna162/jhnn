import { BadRequestException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  const prisma = {
    branch: { findUnique: jest.fn() },
    serviceType: { findUnique: jest.fn() },
    ticket: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    ticketEvent: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    operatorShift: { findFirst: jest.fn() },
    userServiceAccess: { findMany: jest.fn() },
  } as any;

  const notificationsService = {
    sendTicketNotifications: jest.fn().mockResolvedValue({ success: true }),
  } as any;

  const auditService = {
    logAction: jest.fn().mockResolvedValue(null),
  } as any;

  let service: TicketsService;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.ticket.findMany.mockResolvedValue([]);
    service = new TicketsService(prisma, notificationsService, auditService);
  });

  it('creates ticket and triggers notifications', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
    prisma.serviceType.findUnique.mockResolvedValue({ id: 's1', isActive: true, prefix: 'A' });
    prisma.ticket.findFirst.mockResolvedValue(null);
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.create.mockResolvedValue({ id: 't1', number: 'A1' });

    const result = await service.create({
      branchId: '8dfd0892-2484-4438-9815-3ea5a25769d0',
      serviceTypeId: '4fd86463-f9e6-4f31-9209-9a8a6ee2d152',
      phone: '+380501112233',
      clientName: 'Test',
    });

    expect(result.ticket.id).toBe('t1');
    expect(notificationsService.sendTicketNotifications).toHaveBeenCalledWith('t1', 'TICKET_CREATED');
  });

  it('throws if duplicate active ticket exists', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
    prisma.serviceType.findUnique.mockResolvedValue({ id: 's1', isActive: true, prefix: 'A' });
    prisma.ticket.findFirst.mockResolvedValue({ id: 't1', number: 'A12' });

    await expect(
      service.create({
        branchId: '8dfd0892-2484-4438-9815-3ea5a25769d0',
        serviceTypeId: '4fd86463-f9e6-4f31-9209-9a8a6ee2d152',
        phone: '+380501112233',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retries ticket creation when number unique conflict occurs', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
    prisma.serviceType.findUnique.mockResolvedValue({ id: 's1', isActive: true, prefix: 'A' });
    prisma.ticket.findFirst.mockResolvedValue(null);
    prisma.ticket.findMany
      .mockResolvedValueOnce([{ number: 'A1' }])
      .mockResolvedValueOnce([{ number: 'A1' }, { number: 'A2' }]);

    const uniqueConflict = Object.assign(new Error('unique conflict'), { code: 'P2002' });
    prisma.ticket.create
      .mockRejectedValueOnce(uniqueConflict)
      .mockResolvedValueOnce({ id: 't2', number: 'A3' });

    const result = await service.create({
      branchId: '8dfd0892-2484-4438-9815-3ea5a25769d0',
      serviceTypeId: '4fd86463-f9e6-4f31-9209-9a8a6ee2d152',
      phone: '+380501112244',
      clientName: 'Retry Case',
    });

    expect(prisma.ticket.create).toHaveBeenCalledTimes(2);
    expect(result.ticket.number).toBe('A3');
  });

  it('starts ticket only from CALLED state', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: 't1',
      operatorId: 'u1',
      status: TicketStatus.CALLED,
    });
    prisma.ticket.update.mockResolvedValue({ id: 't1', status: TicketStatus.IN_PROGRESS });

    const result = await service.start('t1', 'u1');
    expect(result.ticket.status).toBe(TicketStatus.IN_PROGRESS);
  });

  it('returns paginated events for a ticket', async () => {
    prisma.ticketEvent.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.ticketEvent.count.mockResolvedValue(5);

    const result = await service.events('t1', { page: '2', limit: '2' });

    expect(prisma.ticketEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: 't1' },
        skip: 2,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'e1' }],
      total: 5,
      page: 2,
      limit: 2,
    });
  });
});
