import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class UpdateUserServiceAccessDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  serviceIds!: string[];
}
