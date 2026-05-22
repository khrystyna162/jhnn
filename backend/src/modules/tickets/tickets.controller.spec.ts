import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController pagination', () => {
  let app: INestApplication;

  const ticketsService = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    create: jest.fn(),
    current: jest.fn(),
    next: jest.fn(),
    details: jest.fn(),
    events: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    redirect: jest.fn(),
  } as any;

  const jwtService = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'operator-token') {
        return { sub: 'operator-1', role: 'OPERATOR' };
      }
      throw new Error('invalid token');
    }),
  } as unknown as JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        JwtAuthGuard,
        { provide: TicketsService, useValue: ticketsService },
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
    await request(app.getHttpServer()).get('/tickets').expect(401);
    expect(ticketsService.list).not.toHaveBeenCalled();
  });

  it('passes scope/currentUser/page/limit to tickets service list', async () => {
    await request(app.getHttpServer())
      .get('/tickets?scope=operator&page=3&limit=7')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(ticketsService.list).toHaveBeenCalledWith(
      'operator',
      'operator-1',
      {
        page: '3',
        limit: '7',
      },
      {
        status: undefined,
        branchId: undefined,
      },
    );
  });

  it('passes page/limit to ticket events endpoint', async () => {
    await request(app.getHttpServer())
      .get('/tickets/t1/events?page=2&limit=4')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(ticketsService.events).toHaveBeenCalledWith('t1', {
      page: '2',
      limit: '4',
    });
  });
});
