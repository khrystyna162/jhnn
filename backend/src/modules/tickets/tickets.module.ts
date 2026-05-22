import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PublicTicketsController } from './public-tickets.controller';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [TicketsController, PublicTicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
