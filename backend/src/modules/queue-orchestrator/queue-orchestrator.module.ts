import { Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module';
import { QueueOrchestratorController } from './queue-orchestrator.controller';
import { QueueOrchestratorService } from './queue-orchestrator.service';

@Module({
  imports: [TicketsModule],
  controllers: [QueueOrchestratorController],
  providers: [QueueOrchestratorService],
  exports: [QueueOrchestratorService],
})
export class QueueOrchestratorModule {}
