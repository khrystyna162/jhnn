import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DisplayController } from './display.controller';
import { DisplayService } from './display.service';

describe('DisplayController', () => {
  let app: INestApplication;

  const displayService = {
    publicDisplay: jest.fn().mockResolvedValue({
      branchId: 'branch-1',
      branchName: 'Branch 1',
      updatedAt: new Date().toISOString(),
      workplaces: [],
      activeTickets: [],
      completedTicketNumbers: [],
    }),
    getSettings: jest.fn().mockResolvedValue({
      branchId: 'branch-1',
      layoutMode: 'FHD',
      ttsEnabled: true,
      ttsRate: 1,
      ttsVolume: 1,
    }),
    updateSettings: jest.fn().mockResolvedValue({
      branchId: 'branch-1',
      layoutMode: 'FHD',
      ttsEnabled: true,
      ttsRate: 1,
      ttsVolume: 1,
    }),
    ttsTest: jest.fn().mockResolvedValue({ success: true }),
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
      controllers: [DisplayController],
      providers: [
        JwtAuthGuard,
        { provide: DisplayService, useValue: displayService },
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

  it('returns public display payload without auth', async () => {
    await request(app.getHttpServer()).get('/public/display/branch-1').expect(200);

    expect(displayService.publicDisplay).toHaveBeenCalledWith('branch-1');
  });

  it('returns 401 for protected settings endpoint without token', async () => {
    await request(app.getHttpServer()).get('/display/settings/branch-1').expect(401);
    expect(displayService.getSettings).not.toHaveBeenCalled();
  });

  it('allows protected settings endpoint with valid token', async () => {
    await request(app.getHttpServer())
      .get('/display/settings/branch-1')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);

    expect(displayService.getSettings).toHaveBeenCalledWith('branch-1');
  });
});
