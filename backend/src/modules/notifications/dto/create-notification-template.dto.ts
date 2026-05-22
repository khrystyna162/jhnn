import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum NotificationChannelDto {
  VIBER = 'VIBER',
  SMS = 'SMS',
}

export class CreateNotificationTemplateDto {
  @IsEnum(NotificationChannelDto)
  channel!: NotificationChannelDto;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
