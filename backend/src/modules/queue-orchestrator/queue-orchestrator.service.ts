import { Injectable } from '@nestjs/common';

import { TicketsService } from '../tickets/tickets.service';

@Injectable()
export class QueueOrchestratorService {
  constructor(private readonly ticketsService: TicketsService) {}

  async getNextForOperator(userId: string, serviceId?: string) {
    return this.ticketsService.next(userId, { serviceId });
  }
}
