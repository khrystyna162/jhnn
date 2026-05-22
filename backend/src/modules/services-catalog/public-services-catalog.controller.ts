import { Controller, Get, Query } from '@nestjs/common';

import { ServicesCatalogService } from './services-catalog.service';

@Controller('public/services')
export class PublicServicesCatalogController {
  constructor(private readonly servicesCatalogService: ServicesCatalogService) {}

  @Get('available-for-branch')
  availableForBranch(
    @Query('branchId') branchId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.servicesCatalogService.availableForBranch(branchId, { page, limit });
  }
}
