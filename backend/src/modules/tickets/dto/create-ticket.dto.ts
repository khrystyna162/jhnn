import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsUUID()
  branchId!: string;

  @IsUUID()
  serviceTypeId!: string;

  @IsString()
  @MinLength(8)
  phone!: string;

  @IsOptional()
  @IsString()
  clientName?: string;
}
