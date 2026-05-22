import { RolesPermissionsService } from './roles-permissions.service';

describe('RolesPermissionsService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userPermission: {
      findMany: jest.fn(),
    },
    userScope: {
      findMany: jest.fn(),
    },
    userServiceAccess: {
      findMany: jest.fn(),
    },
  } as any;

  let service: RolesPermissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RolesPermissionsService(prisma);
  });

  it('paginates listPermissions()', async () => {
    prisma.permission.findMany.mockResolvedValue([{ code: 'USERS_READ' }]);
    prisma.permission.count.mockResolvedValue(11);

    const result = await service.listPermissions({ page: '3', limit: '4' });

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 8,
        take: 4,
      }),
    );
    expect(result).toEqual({
      data: [{ code: 'USERS_READ' }],
      total: 11,
      page: 3,
      limit: 4,
    });
  });

  it('returns getUserAccess() snapshot', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.userPermission.findMany.mockResolvedValue([
      { permission: { code: 'USERS_READ' } },
      { permission: { code: 'USERS_UPDATE' } },
    ]);
    prisma.userScope.findMany.mockResolvedValue([
      {
        level: 'CITY',
        countryId: null,
        cityId: 'city-1',
        districtId: null,
        branchId: null,
      },
    ]);
    prisma.userServiceAccess.findMany.mockResolvedValue([
      { serviceTypeId: 'svc-1' },
      { serviceTypeId: 'svc-2' },
    ]);

    const result = await service.getUserAccess('u1');

    expect(result).toEqual({
      permissions: ['USERS_READ', 'USERS_UPDATE'],
      scopes: [
        {
          level: 'CITY',
          countryId: null,
          cityId: 'city-1',
          districtId: null,
          branchId: null,
        },
      ],
      serviceIds: ['svc-1', 'svc-2'],
    });
  });
});
