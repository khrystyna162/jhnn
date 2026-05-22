import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TtsTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  text?: string;
}
