import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController pagination', () => {
  let app: INestApplication;

  const usersService = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    resetPassword: jest.fn(),
  } as any;

  const jwtService = {
    verifyAsync: jest.fn(async (token: string) => {
      if (token === 'valid-token') {
        return { sub: 'u1', role: 'ADMIN' };
      }
      throw new Error('invalid token');
    }),
  } as unknown as JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        JwtAuthGuard,
        { provide: UsersService, useValue: usersService },
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
    await request(app.getHttpServer()).get('/users').expect(401);
    expect(usersService.list).not.toHaveBeenCalled();
  });

  it('passes role/page/limit to users service list', async () => {
    await request(app.getHttpServer())
      .get('/users?role=ADMIN&page=2&limit=5')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(usersService.list).toHaveBeenCalledWith('ADMIN', undefined, { page: '2', limit: '5' });
  });

  it('passes search and status filters to users service list', async () => {
    await request(app.getHttpServer())
      .get('/users?search=ivan&status=ACTIVE')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(usersService.list).toHaveBeenCalledWith(undefined, { search: 'ivan', status: 'ACTIVE' }, { page: undefined, limit: undefined });
  });
});
