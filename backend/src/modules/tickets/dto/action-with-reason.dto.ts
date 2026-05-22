import { IsString, MinLength } from 'class-validator';

export class ActionWithReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}
