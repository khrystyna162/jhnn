import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { OrgStructureController } from './org-structure.controller';
import { OrgStructureService } from './org-structure.service';

@Module({
	imports: [AuditModule],
	controllers: [OrgStructureController],
	providers: [OrgStructureService],
	exports: [OrgStructureService],
})
export class OrgStructureModule {}
