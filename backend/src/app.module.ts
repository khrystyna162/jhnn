import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './modules/users/users.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { OrgStructureModule } from './modules/org-structure/org-structure.module';
import { ServicesCatalogModule } from './modules/services-catalog/services-catalog.module';
import { ServiceTypesModule } from './modules/service-types/service-types.module';
import { WorkplacesModule } from './modules/workplaces/workplaces.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { QueueOrchestratorModule } from './modules/queue-orchestrator/queue-orchestrator.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DisplayModule } from './modules/display/display.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RolesPermissionsModule,
    OrgStructureModule,
    ServicesCatalogModule,
    ServiceTypesModule,
    WorkplacesModule,
    TicketsModule,
    QueueOrchestratorModule,
    NotificationsModule,
    DisplayModule,
    AnalyticsModule,
    AuditModule,
    SystemModule,
  ],
})
export class AppModule {}
