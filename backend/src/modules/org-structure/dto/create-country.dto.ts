import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
