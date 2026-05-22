import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DisplayService } from './display.service';
import { TtsTestDto } from './dto/tts-test.dto';
import { UpdateDisplaySettingsDto } from './dto/update-display-settings.dto';

@Controller()
export class DisplayController {
  constructor(private readonly displayService: DisplayService) {}

  @Get('public/display/:branchId')
  publicDisplay(@Param('branchId') branchId: string) {
    return this.displayService.publicDisplay(branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('display/settings/:branchId')
  getSettings(@Param('branchId') branchId: string) {
    return this.displayService.getSettings(branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('display/settings/:branchId')
  updateSettings(@Param('branchId') branchId: string, @Body() dto: UpdateDisplaySettingsDto) {
    return this.displayService.updateSettings(branchId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('display/tts/test')
  ttsTest(@Body() dto: TtsTestDto) {
    return this.displayService.ttsTest(dto);
  }
}
