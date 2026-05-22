import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum UserRoleDto {
  OPERATOR = 'OPERATOR',
  ADMIN = 'ADMIN',
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRoleDto)
  role!: UserRoleDto;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
