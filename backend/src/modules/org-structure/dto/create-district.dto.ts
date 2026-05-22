import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDistrictDto {
  @IsUUID()
  cityId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
