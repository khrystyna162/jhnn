import { Module } from '@nestjs/common';

import { PublicTerminalsController } from './public-terminals.controller';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
	controllers: [SystemController, PublicTerminalsController],
	providers: [SystemService],
	exports: [SystemService],
})
export class SystemModule {}
