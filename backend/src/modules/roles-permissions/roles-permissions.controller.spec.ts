import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesPermissionsController } from './roles-permissions.controller';
import { RolesPermissionsService } from './roles-permissions.service';

describe('RolesPermissionsController pagination', () => {
  let app: INestApplication;

  const rolesPermissionsService = {
    listPermissions: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    getUserAccess: jest.fn().mockResolvedValue({ permissions: [], scopes: [], serviceIds: [] }),
    updateUserPermissions: jest.fn(),
    updateUserScopes: jest.fn(),
    updateUserServiceAccess: jest.fn(),
  } as any;

  const jwtService = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'admin-token') {
        return { sub: 'admin-1', role: 'ADMIN' };
      }
      throw new Error('invalid token');
    }),
  } as unknown as JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RolesPermissionsController],
      providers: [
        JwtAuthGuard,
        { provide: RolesPermissionsService, useValue: rolesPermissionsService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without bearer token', async () => {
    await request(app.getHttpServer()).get('/permissions').expect(401);
    expect(rolesPermissionsService.listPermissions).not.toHaveBeenCalled();
  });

  it('passes page/limit to listPermissions()', async () => {
    await request(app.getHttpServer())
      .get('/permissions?page=5&limit=2')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(rolesPermissionsService.listPermissions).toHaveBeenCalledWith({ page: '5', limit: '2' });
  });

  it('passes userId to getUserAccess()', async () => {
    await request(app.getHttpServer())
      .get('/users/user-42/access')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(rolesPermissionsService.getUserAccess).toHaveBeenCalledWith('user-42');
  });
});
