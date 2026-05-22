import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController authz', () => {
  let app: INestApplication;

  const auditService = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    byEntity: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  } as any;

  const jwtService = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'admin-token') {
        return { sub: 'u-admin', role: 'ADMIN' };
      }
      if (token === 'sysadmin-token') {
        return { sub: 'u-sys', role: 'SYSADMIN' };
      }
      if (token === 'operator-token') {
        return { sub: 'u-op', role: 'OPERATOR' };
      }
      throw new Error('invalid token');
    }),
  } as unknown as JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        { provide: AuditService, useValue: auditService },
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

  it('returns 403 for operator role', async () => {
    await request(app.getHttpServer())
      .get('/audit')
      .set('Authorization', 'Bearer operator-token')
      .expect(403);

    expect(auditService.list).not.toHaveBeenCalled();
  });

  it('returns 200 for admin role', async () => {
    await request(app.getHttpServer())
      .get('/audit?page=1&limit=10')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(auditService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: '1', limit: '10' }),
    );
  });

  it('returns 200 for sysadmin role', async () => {
    await request(app.getHttpServer())
      .get('/audit/entity/TICKET/t1?limit=25')
      .set('Authorization', 'Bearer sysadmin-token')
      .expect(200);

    expect(auditService.byEntity).toHaveBeenCalledWith('TICKET', 't1', 25);
  });
});
