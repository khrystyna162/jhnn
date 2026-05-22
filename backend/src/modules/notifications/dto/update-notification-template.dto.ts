import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
