import { IsUUID } from 'class-validator';

export class StartShiftDto {
  @IsUUID()
  workplaceId!: string;
}
