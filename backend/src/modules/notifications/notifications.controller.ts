import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { TestSendDto } from './dto/test-send.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { NotificationsService } from './notifications.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications/:ticketId/status')
  status(@Param('ticketId') ticketId: string) {
    return this.notificationsService.getTicketStatus(ticketId);
  }

  @Get('notification-templates')
  listTemplates(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.notificationsService.listTemplates({ page, limit });
  }

  @Post('notification-templates')
  createTemplate(@Body() dto: CreateNotificationTemplateDto) {
    return this.notificationsService.createTemplate(dto);
  }

  @Patch('notification-templates/:templateId')
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(templateId, dto);
  }

  @Post('notification-templates/:templateId/test-send')
  testSend(@Param('templateId') templateId: string, @Body() dto: TestSendDto) {
    return this.notificationsService.testSend(templateId, dto);
  }

  @Get('notifications/delivery-log')
  deliveryLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.notificationsService.deliveryLog({ page, limit });
  }

  @Post('notifications/tickets/:ticketId/send')
  sendTicket(@Param('ticketId') ticketId: string) {
    return this.notificationsService.sendTicketNotifications(ticketId);
  }

  @Delete('notification-templates/:templateId')
  deleteTemplate(@Param('templateId') templateId: string) {
    return this.notificationsService.deleteTemplate(templateId);
  }
}
