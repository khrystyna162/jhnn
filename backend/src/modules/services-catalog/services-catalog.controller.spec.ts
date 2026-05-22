import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServicesCatalogController } from './services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';

describe('ServicesCatalogController pagination', () => {
  let app: INestApplication;

  const servicesCatalogService = {
    list: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    usage: jest.fn().mockResolvedValue({ service: { id: 's1' }, workplaces: [], operators: [] }),
    myAvailable: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    availableForBranch: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
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
      controllers: [ServicesCatalogController],
      providers: [
        JwtAuthGuard,
        { provide: ServicesCatalogService, useValue: servicesCatalogService },
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
    await request(app.getHttpServer()).get('/services').expect(401);
    expect(servicesCatalogService.list).not.toHaveBeenCalled();
  });

  it('passes page/limit to list()', async () => {
    await request(app.getHttpServer())
      .get('/services?page=2&limit=8')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.list).toHaveBeenCalledWith(undefined, { page: '2', limit: '8' });
  });

  it('passes search/status filters to list()', async () => {
    await request(app.getHttpServer())
      .get('/services?search=call&status=ACTIVE&page=1&limit=5')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.list).toHaveBeenCalledWith(
      { search: 'call', status: 'ACTIVE' },
      { page: '1', limit: '5' },
    );
  });

  it('passes update payload to update()', async () => {
    await request(app.getHttpServer())
      .patch('/services/s1')
      .set('Authorization', 'Bearer operator-token')
      .send({ name: 'Updated', prefix: 'UPD', isActive: true })
      .expect(200);

    expect(servicesCatalogService.update).toHaveBeenCalledWith('s1', { name: 'Updated', prefix: 'UPD', isActive: true });
  });

  it('passes service id to delete()', async () => {
    await request(app.getHttpServer())
      .delete('/services/s1')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.delete).toHaveBeenCalledWith('s1');
  });

  it('passes service id to usage()', async () => {
    await request(app.getHttpServer())
      .get('/services/s1/usage')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.usage).toHaveBeenCalledWith('s1');
  });

  it('passes current user and pagination to myAvailable()', async () => {
    await request(app.getHttpServer())
      .get('/services/my-available?page=3&limit=4')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.myAvailable).toHaveBeenCalledWith('operator-1', {
      page: '3',
      limit: '4',
    });
  });

  it('passes branchId and pagination to availableForBranch()', async () => {
    await request(app.getHttpServer())
      .get('/services/available-for-branch?branchId=b1&page=1&limit=6')
      .set('Authorization', 'Bearer operator-token')
      .expect(200);

    expect(servicesCatalogService.availableForBranch).toHaveBeenCalledWith('b1', {
      page: '1',
      limit: '6',
    });
  });
});
