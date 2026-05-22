import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TicketsService } from './tickets.service';
import { ActionWithReasonDto } from './dto/action-with-reason.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { NextTicketDto } from './dto/next-ticket.dto';
import { RedirectTicketDto } from './dto/redirect-ticket.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  list(
    @Query('scope') scope?: 'operator' | 'admin',
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @CurrentUserId() userId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.list(scope, userId, { page, limit }, { status, branchId });
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUserId() userId?: string) {
    return this.ticketsService.create(dto, userId);
  }

  @Get('current')
  current(@CurrentUserId() userId?: string) {
    return this.ticketsService.current(userId);
  }

  @Post('next')
  next(@CurrentUserId() userId: string, @Body() dto: NextTicketDto) {
    return this.ticketsService.next(userId, dto);
  }

  @Post(':ticketId/call')
  callSpecific(@Param('ticketId') ticketId: string, @CurrentUserId() userId: string) {
    return this.ticketsService.callSpecific(ticketId, userId);
  }

  @Get(':ticketId')
  details(@Param('ticketId') ticketId: string) {
    return this.ticketsService.details(ticketId);
  }

  @Get(':ticketId/events')
  events(
    @Param('ticketId') ticketId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.events(ticketId, { page, limit });
  }

  @Post(':ticketId/start')
  start(@Param('ticketId') ticketId: string, @CurrentUserId() userId?: string) {
    return this.ticketsService.start(ticketId, userId);
  }

  @Post(':ticketId/complete')
  complete(@Param('ticketId') ticketId: string, @CurrentUserId() userId?: string) {
    return this.ticketsService.complete(ticketId, userId);
  }

  @Post(':ticketId/cancel')
  cancel(
    @Param('ticketId') ticketId: string,
    @Body() dto: ActionWithReasonDto,
    @CurrentUserId() userId?: string,
  ) {
    return this.ticketsService.cancel(ticketId, dto.reason, userId);
  }

  @Post(':ticketId/redirect')
  redirect(
    @Param('ticketId') ticketId: string,
    @Body() dto: RedirectTicketDto,
    @CurrentUserId() userId?: string,
  ) {
    return this.ticketsService.redirect(ticketId, dto.targetServiceTypeId, dto.reason, userId);
  }
}
