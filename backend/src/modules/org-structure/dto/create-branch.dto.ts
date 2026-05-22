import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsUUID()
  countryId!: string;

  @IsUUID()
  cityId!: string;

  @IsUUID()
  districtId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string;
}
