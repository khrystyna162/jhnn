import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateOrgEntityDto } from './dto/update-org-entity.dto';
import { OrgStructureService } from './org-structure.service';

@Controller('org')
@UseGuards(JwtAuthGuard)
export class OrgStructureController {
  constructor(private readonly orgStructureService: OrgStructureService) {}

  @Get('tree')
  tree() {
    return this.orgStructureService.getTree();
  }

  @Get('countries')
  countries() {
    return this.orgStructureService.getCountries();
  }

  @Get('cities')
  cities(@Query('countryId') countryId?: string) {
    return this.orgStructureService.getCities(countryId);
  }

  @Get('districts')
  districts(@Query('cityId') cityId?: string) {
    return this.orgStructureService.getDistricts(cityId);
  }

  @Get('branches')
  branches(@Query('districtId') districtId?: string) {
    return this.orgStructureService.getBranches(districtId);
  }

  @Post('countries')
  createCountry(@Body() dto: CreateCountryDto, @CurrentUserId() actorId?: string) {
    return this.orgStructureService.createCountry(dto, actorId);
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto, @CurrentUserId() actorId?: string) {
    return this.orgStructureService.createCity(dto, actorId);
  }

  @Post('districts')
  createDistrict(@Body() dto: CreateDistrictDto, @CurrentUserId() actorId?: string) {
    return this.orgStructureService.createDistrict(dto, actorId);
  }

  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto, @CurrentUserId() actorId?: string) {
    return this.orgStructureService.createBranch(dto, actorId);
  }

  @Patch(':entity/:id')
  updateEntity(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrgEntityDto,
    @CurrentUserId() actorId?: string,
  ) {
    return this.orgStructureService.updateEntity(entity, id, dto, actorId);
  }

  @Delete(':entity/:id')
  deleteEntity(@Param('entity') entity: string, @Param('id') id: string, @CurrentUserId() actorId?: string) {
    return this.orgStructureService.deleteEntity(entity, id, actorId);
  }
}
