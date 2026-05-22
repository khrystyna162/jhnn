import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesCatalogService } from './services-catalog.service';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesCatalogController {
  constructor(private readonly servicesCatalogService: ServicesCatalogService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = search || status ? { search, status } : undefined;
    return this.servicesCatalogService.list(filters, { page, limit });
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.servicesCatalogService.create(dto);
  }

  @Patch(':serviceId')
  update(@Param('serviceId') serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.servicesCatalogService.update(serviceId, dto);
  }

  @Delete(':serviceId')
  delete(@Param('serviceId') serviceId: string) {
    return this.servicesCatalogService.delete(serviceId);
  }

  @Get(':serviceId/usage')
  usage(@Param('serviceId') serviceId: string) {
    return this.servicesCatalogService.usage(serviceId);
  }

  @Get('my-available')
  myAvailable(
    @CurrentUserId() userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.servicesCatalogService.myAvailable(userId, { page, limit });
  }

  @Get('available-for-branch')
  availableForBranch(
    @Query('branchId') branchId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.servicesCatalogService.availableForBranch(branchId, { page, limit });
  }
}
