import { IsOptional, IsUUID } from 'class-validator';

export class NextTicketDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
