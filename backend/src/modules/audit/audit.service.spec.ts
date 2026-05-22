import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as any;

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma);
  });

  it('writes audit record via logAction', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'a1' });

    const result = await service.logAction({
      actorId: 'u1',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 'u2',
      meta: { role: 'OPERATOR' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'u1',
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: 'u2',
        meta: { role: 'OPERATOR' },
        ipAddress: undefined,
        userAgent: undefined,
      },
    });
    expect(result.id).toBe('a1');
  });

  it('returns paginated audit list', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    prisma.auditLog.count.mockResolvedValue(7);

    const result = await service.list({
      page: '2',
      limit: '2',
      action: 'TICKET_CALLED',
      actorId: 'u1',
      entityType: 'TICKET',
      entityId: 't1',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-02T00:00:00.000Z',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: 'TICKET_CALLED',
          actorId: 'u1',
          entityType: 'TICKET',
          entityId: 't1',
        }),
        skip: 2,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'a1' }, { id: 'a2' }],
      total: 7,
      page: 2,
      limit: 2,
    });
  });

  it('returns entity history with bounded limit', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }]);

    const result = await service.byEntity('TICKET', 't1', 500);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: 'TICKET',
          entityId: 't1',
        },
        take: 200,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'a1' }],
      total: 1,
    });
  });
});
