import { Controller, Get, Query } from '@nestjs/common';

import { SystemService } from './system.service';

@Controller('public/terminals')
export class PublicTerminalsController {
  constructor(private readonly systemService: SystemService) {}

  @Get('resolve')
  resolve(@Query('apiKey') apiKey: string) {
    return this.systemService.resolveTerminalByApiKey(apiKey ?? '', { touchLastSeen: true });
  }
}
