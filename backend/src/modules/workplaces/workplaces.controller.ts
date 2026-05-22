import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkplacesService } from './workplaces.service';
import { StartShiftDto } from './dto/start-shift.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkplacesController {
  constructor(private readonly workplacesService: WorkplacesService) {}

  @Get('workplaces')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.workplacesService.list({ page, limit }, branchId);
  }

  @Get('operator-shifts/current')
  currentShift(@CurrentUserId() userId?: string) {
    return this.workplacesService.currentShift(userId);
  }

  @Get('workplaces/my-available')
  myAvailable(
    @CurrentUserId() userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workplacesService.myAvailable(userId, { page, limit });
  }

  @Post('operator-shifts/start')
  startShift(@CurrentUserId() userId: string, @Body() dto: StartShiftDto) {
    return this.workplacesService.startShift(userId, dto);
  }

  @Post('operator-shifts/end')
  endShift(@CurrentUserId() userId?: string) {
    return this.workplacesService.endShift(userId);
  }

  @Post('workplaces')
  create(
    @Body() dto: { number: string; branchId: string; serviceId?: string; isActive?: boolean },
    @CurrentUserId() actorId?: string,
  ) {
    return this.workplacesService.create(dto, actorId);
  }

  @Patch('workplaces/:workplaceId')
  update(
    @Param('workplaceId') workplaceId: string,
    @Body() dto: { number?: string; branchId?: string; serviceId?: string; isActive?: boolean },
    @CurrentUserId() actorId?: string,
  ) {
    return this.workplacesService.update(workplaceId, dto, actorId);
  }

  @Delete('workplaces/:workplaceId')
  remove(@Param('workplaceId') workplaceId: string, @CurrentUserId() actorId?: string) {
    return this.workplacesService.remove(workplaceId, actorId);
  }
}
