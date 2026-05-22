import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkplacesController } from './workplaces.controller';
import { WorkplacesService } from './workplaces.service';

describe('WorkplacesController pagination', () => {
  let app: INestApplication;

  const workplacesService = {
    currentShift: jest.fn().mockResolvedValue({ shift: null }),
    myAvailable: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    startShift: jest.fn(),
    endShift: jest.fn(),
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
      controllers: [WorkplacesController],
      providers: [
        JwtAuthGuard,
        { provide: WorkplacesService, useValue: workplacesService },
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
    await request(app.getHttpServer()).get('/workplaces/my-available').expect(401);
    expect(workplacesService.myAvailable).not.toHaveBeenCalled();
  });

  it('passes current user and pagination to myAvailable()', async () => {
    await request(app.getHttpServer())
      .get('/workplaces/my-available?page=2&limit=9')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(workplacesService.myAvailable).toHaveBeenCalledWith('operator-1', {
      page: '2',
      limit: '9',
    });
  });

  it('passes current user to currentShift()', async () => {
    await request(app.getHttpServer())
      .get('/operator-shifts/current')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(workplacesService.currentShift).toHaveBeenCalledWith('operator-1');
  });
});
