import { IsEnum } from 'class-validator';

export enum ProviderModeDto {
  mock = 'mock',
  sandbox = 'sandbox',
  production = 'production',
}

export class SwitchProviderDto {
  @IsEnum(ProviderModeDto)
  mode!: ProviderModeDto;
}
