import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

enum ScopeLevelDto {
  ALL = 'ALL',
  COUNTRY = 'COUNTRY',
  CITY = 'CITY',
  DISTRICT = 'DISTRICT',
  BRANCH = 'BRANCH',
}

class ScopeItemDto {
  @IsEnum(ScopeLevelDto)
  level!: ScopeLevelDto;

  @IsOptional()
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  districtId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateUserScopesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ScopeItemDto)
  scopes!: ScopeItemDto[];
}
