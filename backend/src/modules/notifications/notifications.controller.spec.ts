import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController pagination', () => {
  let app: INestApplication;

  const notificationsService = {
    getTicketStatus: jest.fn(),
    listTemplates: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn().mockResolvedValue({ success: true }),
    testSend: jest.fn(),
    deliveryLog: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    sendTicketNotifications: jest.fn(),
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
      controllers: [NotificationsController],
      providers: [
        JwtAuthGuard,
        { provide: NotificationsService, useValue: notificationsService },
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
    await request(app.getHttpServer()).get('/notification-templates').expect(401);
    expect(notificationsService.listTemplates).not.toHaveBeenCalled();
  });

  it('passes page/limit to listTemplates()', async () => {
    await request(app.getHttpServer())
      .get('/notification-templates?page=4&limit=3')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(notificationsService.listTemplates).toHaveBeenCalledWith({ page: '4', limit: '3' });
  });

  it('passes page/limit to deliveryLog()', async () => {
    await request(app.getHttpServer())
      .get('/notifications/delivery-log?page=2&limit=10')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(notificationsService.deliveryLog).toHaveBeenCalledWith({ page: '2', limit: '10' });
  });

  it('deletes template by id', async () => {
    await request(app.getHttpServer())
      .delete('/notification-templates/tpl-1')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(notificationsService.deleteTemplate).toHaveBeenCalledWith('tpl-1');
  });
});
