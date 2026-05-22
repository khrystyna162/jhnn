import { IsString, IsUUID, MinLength } from 'class-validator';

export class RedirectTicketDto {
  @IsUUID()
  targetServiceTypeId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}
