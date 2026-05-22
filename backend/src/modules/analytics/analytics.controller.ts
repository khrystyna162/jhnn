import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpi-summary')
  kpiSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.kpiSummary({ from, to, branchId });
  }

  @Get('dashboard')
  dashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.dashboard({ from, to, branchId });
  }

  @Get('waiting-time')
  waitingTime(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.waitingTime({ from, to, branchId });
  }

  @Get('service-time')
  serviceTime(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.serviceTime({ from, to, branchId });
  }

  @Get('operators-rating')
  operatorsRating(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.operatorsRating({ from, to, branchId });
  }

  @Get('export')
  export(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.analyticsService.export({ from, to, branchId });
  }
}
