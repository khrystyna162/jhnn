import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QueueOrchestratorService } from './queue-orchestrator.service';

@Controller('queue')
@UseGuards(JwtAuthGuard)
export class QueueOrchestratorController {
  constructor(private readonly queueOrchestratorService: QueueOrchestratorService) {}

  @Post('next')
  next(
    @CurrentUserId() userId: string,
    @Body() body: { serviceId?: string },
  ) {
    return this.queueOrchestratorService.getNextForOperator(userId, body?.serviceId);
  }
}
