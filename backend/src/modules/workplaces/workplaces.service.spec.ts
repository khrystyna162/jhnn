import { WorkplacesService } from './workplaces.service';

describe('WorkplacesService', () => {
  const tx = {
    operatorShift: {
      updateMany: jest.fn(),
    },
    ticket: {
      updateMany: jest.fn(),
    },
    ticketEvent: {
      createMany: jest.fn(),
    },
  } as any;

  const prisma = {
    userScope: {
      findMany: jest.fn(),
    },
    operatorShift: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    ticketEvent: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (txClient: typeof tx) => unknown) => callback(tx)),
    workplace: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as any;

  const auditService = {
    logAction: jest.fn().mockResolvedValue(null),
  } as any;

  let service: WorkplacesService;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.operatorShift.updateMany.mockReset();
    tx.ticket.updateMany.mockReset();
    tx.ticketEvent.createMany.mockReset();
    service = new WorkplacesService(prisma, auditService);
  });

  it('paginates myAvailable()', async () => {
    prisma.userScope.findMany.mockResolvedValue([{ level: 'ALL', branchId: null }]);
    prisma.workplace.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
    prisma.workplace.count.mockResolvedValue(7);

    const result = await service.myAvailable('u1', { page: '2', limit: '2' });

    expect(prisma.workplace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'w1' }, { id: 'w2' }],
      total: 7,
      page: 2,
      limit: 2,
    });
  });

  it('returns the latest open currentShift() with workplace summary', async () => {
    prisma.operatorShift.findFirst.mockResolvedValue({
      id: 'shift-1',
      userId: 'u1',
      workplaceId: 'wp-1',
      status: 'OPEN',
      startedAt: new Date('2026-05-06T09:00:00.000Z'),
      endedAt: null,
      workplace: {
        id: 'wp-1',
        name: '3',
      },
    });

    const result = await service.currentShift('u1');

    expect(prisma.operatorShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          status: 'OPEN',
        },
      }),
    );
    expect(result).toEqual({
      shift: {
        id: 'shift-1',
        userId: 'u1',
        workplaceId: 'wp-1',
        status: 'OPEN',
        startedAt: new Date('2026-05-06T09:00:00.000Z'),
        endedAt: null,
      },
      workplace: {
        id: 'wp-1',
        number: '3',
      },
    });
  });

  it('auto-cancels active tickets as unserved when ending shift', async () => {
    prisma.operatorShift.findMany.mockResolvedValue([
      {
        id: 'shift-1',
        workplace: { branchId: 'branch-1' },
      },
    ]);
    prisma.ticket.findMany.mockResolvedValue([
      { id: 't-1', status: 'WAITING' },
      { id: 't-2', status: 'IN_PROGRESS' },
    ]);
    tx.operatorShift.updateMany.mockResolvedValue({ count: 1 });
    tx.ticket.updateMany.mockResolvedValue({ count: 2 });
    tx.ticketEvent.createMany.mockResolvedValue({ count: 2 });

    const result = await service.endShift('operator-1');

    expect(prisma.operatorShift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'operator-1',
          status: 'OPEN',
        },
      }),
    );
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: ['branch-1'] },
        }),
      }),
    );
    expect(tx.operatorShift.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'operator-1',
          status: 'OPEN',
        },
      }),
    );
    expect(tx.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'Не обслужено: кінець зміни',
        }),
      }),
    );
    expect(tx.ticketEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            ticketId: 't-1',
            eventType: 'CANCELLED_BY_SHIFT_END',
            reason: 'Не обслужено: кінець зміни',
          }),
        ]),
      }),
    );
    expect(result).toEqual({
      success: true,
      closed: 1,
      autoCancelledTickets: 2,
    });
  });
});
