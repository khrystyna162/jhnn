import { NotFoundException } from '@nestjs/common';

import { ServicesCatalogService } from './services-catalog.service';

describe('ServicesCatalogService', () => {
  const prisma = {
    serviceType: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workplaceServiceType: {
      findMany: jest.fn(),
    },
    userServiceAccess: {
      findMany: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
  } as any;

  let service: ServicesCatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServicesCatalogService(prisma);
  });

  it('paginates list()', async () => {
    prisma.serviceType.findMany.mockResolvedValue([{ id: 's1' }]);
    prisma.serviceType.count.mockResolvedValue(9);

    const result = await service.list(undefined, { page: '2', limit: '5' });

    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 's1' }],
      total: 9,
      page: 2,
      limit: 5,
    });
  });

  it('paginates myAvailable()', async () => {
    prisma.serviceType.findMany.mockResolvedValue([{ id: 's2' }]);
    prisma.serviceType.count.mockResolvedValue(3);

    const result = await service.myAvailable('u1', { page: '1', limit: '2' });

    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 2,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 's2' }],
      total: 3,
      page: 1,
      limit: 2,
    });
  });

  it('filters list() by search and status', async () => {
    prisma.serviceType.findMany.mockResolvedValue([{ id: 's3' }]);
    prisma.serviceType.count.mockResolvedValue(1);

    await service.list({ search: 'vip', status: 'ACTIVE' }, { page: '1', limit: '10' });

    expect(prisma.serviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('updates a service type', async () => {
    prisma.serviceType.findUnique.mockResolvedValue({ id: 's1' });
    prisma.serviceType.update.mockResolvedValue({ id: 's1', name: 'Updated' });

    const result = await service.update('s1', { name: 'Updated', prefix: 'UPD', isActive: false });

    expect(prisma.serviceType.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({
          name: 'Updated',
          prefix: 'UPD',
          isActive: false,
        }),
      }),
    );
    expect(result).toEqual({ service: { id: 's1', name: 'Updated' } });
  });

  it('deletes a service type', async () => {
    prisma.serviceType.findUnique.mockResolvedValue({ id: 's1' });
    prisma.serviceType.update.mockResolvedValue({ id: 's1', isActive: false });

    await expect(service.delete('s1')).resolves.toEqual({ success: true });
    expect(prisma.serviceType.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { isActive: false },
    });
  });

  it('returns service usage details', async () => {
    prisma.serviceType.findUnique.mockResolvedValue({
      id: 's1',
      code: 'S1',
      name: 'Service 1',
      prefix: 'S1',
      slaMinutes: 15,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.workplaceServiceType.findMany.mockResolvedValue([
      {
        workplace: {
          id: 'w1',
          name: '1',
          isActive: true,
          branch: {
            id: 'b1',
            name: 'Branch 1',
            district: {
              id: 'd1',
              name: 'District 1',
              city: {
                id: 'c1',
                name: 'City 1',
                country: {
                  id: 'ct1',
                  name: 'Country 1',
                },
              },
            },
          },
        },
      },
    ]);
    prisma.userServiceAccess.findMany.mockResolvedValue([
      {
        user: {
          id: 'u1',
          fullName: 'Ivan Petrenko',
          email: 'ivan@example.com',
          role: 'OPERATOR',
          isActive: true,
        },
      },
    ]);

    const result = await service.usage('s1');

    expect(prisma.workplaceServiceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serviceTypeId: 's1' } }),
    );
    expect(prisma.userServiceAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { serviceTypeId: 's1' } }),
    );
    expect(result.workplaces).toHaveLength(1);
    expect(result.operators).toHaveLength(1);
    expect(result.service.id).toBe('s1');
  });

  it('throws for missing branch in availableForBranch()', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);

    await expect(service.availableForBranch('b-missing', { page: '1', limit: '10' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
