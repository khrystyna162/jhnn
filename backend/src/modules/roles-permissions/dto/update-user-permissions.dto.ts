import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions!: string[];
}
