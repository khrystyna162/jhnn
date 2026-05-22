import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCityDto {
  @IsUUID()
  countryId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
