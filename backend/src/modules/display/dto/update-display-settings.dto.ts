import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

enum LayoutModeDto {
  FHD = 'FHD',
  UHD = 'UHD',
}

export class UpdateDisplaySettingsDto {
  @IsOptional()
  @IsEnum(LayoutModeDto)
  layoutMode?: LayoutModeDto;

  @IsOptional()
  @IsBoolean()
  ttsEnabled?: boolean;

  @IsOptional()
  @IsString()
  ttsVoice?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2)
  ttsRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ttsVolume?: number;
}
