import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SwitchProviderDto } from './dto/switch-provider.dto';
import { SystemService } from './system.service';

type TerminalStatus = 'ACTIVE' | 'INACTIVE';
type TerminalDto = {
  id: string;
  name: string;
  branchId: string;
  branchName?: string;
  status: TerminalStatus;
  apiKey: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
};

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('settings')
  settings() {
    return this.systemService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() payload: Record<string, unknown>) {
    return this.systemService.updateSettings(payload);
  }

  @Get('health')
  health() {
    return this.systemService.health();
  }

  @Get('metrics')
  metrics() {
    return this.systemService.metrics();
  }

  @Post('notification-provider/switch')
  switchProvider(@Body() dto: SwitchProviderDto) {
    return this.systemService.switchProvider(dto.mode);
  }

  @Get('terminals')
  terminals(): Promise<{ data: TerminalDto[]; total: number }> {
    return this.systemService.getKioskTerminals();
  }

  @Post('terminals')
  createTerminal(
    @Body() payload: { name: string; branchId: string; status?: 'ACTIVE' | 'INACTIVE'; description?: string },
  ): Promise<{ terminal: TerminalDto }> {
    return this.systemService.createKioskTerminal(payload);
  }

  @Patch('terminals/:terminalId')
  updateTerminal(
    @Param('terminalId') terminalId: string,
    @Body() payload: { name?: string; branchId?: string; status?: 'ACTIVE' | 'INACTIVE'; description?: string; lastSeenAt?: string },
  ): Promise<{ terminal: TerminalDto }> {
    return this.systemService.updateKioskTerminal(terminalId, payload);
  }

  @Post('terminals/:terminalId/rotate-key')
  rotateTerminalKey(@Param('terminalId') terminalId: string): Promise<{ terminal: TerminalDto }> {
    return this.systemService.rotateKioskTerminalKey(terminalId);
  }

  @Delete('terminals/:terminalId')
  deleteTerminal(@Param('terminalId') terminalId: string) {
    return this.systemService.deleteKioskTerminal(terminalId);
  }
}
