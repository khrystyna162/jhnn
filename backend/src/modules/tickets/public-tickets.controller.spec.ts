import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PublicTicketsController } from './public-tickets.controller';
import { TicketsService } from './tickets.service';

describe('PublicTicketsController', () => {
  let app: INestApplication;

  const ticketsService = {
    create: jest.fn().mockResolvedValue({
      id: 'ticket-1',
      number: 'A-001',
      status: 'WAITING',
    }),
  } as any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicTicketsController],
      providers: [{ provide: TicketsService, useValue: ticketsService }],
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

  it('returns 201 without auth and creates ticket via service', async () => {
    const payload = {
      branchId: 'branch-1',
      serviceTypeId: 'service-1',
      customerPhone: '+380991112233',
    };

    await request(app.getHttpServer()).post('/public/tickets').send(payload).expect(201);

    expect(ticketsService.create).toHaveBeenCalledWith(payload);
  });
});
