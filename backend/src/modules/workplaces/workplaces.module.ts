import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WorkplacesController } from './workplaces.controller';
import { WorkplacesService } from './workplaces.service';

@Module({
	imports: [AuditModule],
	controllers: [WorkplacesController],
	providers: [WorkplacesService],
	exports: [WorkplacesService],
})
export class WorkplacesModule {}
