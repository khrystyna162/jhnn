import { IsString, MinLength } from 'class-validator';

export class TestSendDto {
  @IsString()
  @MinLength(8)
  phone!: string;
}
