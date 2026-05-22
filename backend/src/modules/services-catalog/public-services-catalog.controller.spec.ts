import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { PublicServicesCatalogController } from './public-services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';

describe('PublicServicesCatalogController', () => {
  let app: INestApplication;

  const servicesCatalogService = {
    availableForBranch: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
  } as any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicServicesCatalogController],
      providers: [{ provide: ServicesCatalogService, useValue: servicesCatalogService }],
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

  it('returns 200 without auth and forwards query to service', async () => {
    await request(app.getHttpServer())
      .get('/public/services/available-for-branch?branchId=branch-1&page=2&limit=7')
      .expect(200);

    expect(servicesCatalogService.availableForBranch).toHaveBeenCalledWith('branch-1', {
      page: '2',
      limit: '7',
    });
  });
});
