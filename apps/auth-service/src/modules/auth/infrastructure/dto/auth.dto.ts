import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest, RefreshRequest, RegisterRequest } from '@fitness/contracts';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'alex@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePassw0rd!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Alex Doe', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'alex@example.com', format: 'email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'S3curePassw0rd!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshDto implements RefreshRequest {
  @ApiProperty({ description: 'Opaque refresh token issued at login/register' })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
