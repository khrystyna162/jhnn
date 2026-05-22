import { Module } from '@nestjs/common';

import { ServiceTypesModule } from '../service-types/service-types.module';
import { PublicServicesCatalogController } from './public-services-catalog.controller';
import { ServicesCatalogController } from './services-catalog.controller';
import { ServicesCatalogService } from './services-catalog.service';

@Module({
  imports: [ServiceTypesModule],
  controllers: [ServicesCatalogController, PublicServicesCatalogController],
  providers: [ServicesCatalogService],
  exports: [ServicesCatalogService],
})
export class ServicesCatalogModule {}
