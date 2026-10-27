import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  UpdateProfileRequest,
  WeightUnit,
} from '@fitness/contracts';

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

export class UpdateProfileDto implements UpdateProfileRequest {
  @ApiPropertyOptional({ example: 'Alex Doe', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ enum: ['kg', 'lb'], description: 'Unit weights are shown and typed in' })
  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: WeightUnit;

  @ApiPropertyOptional({ example: 12.5, minimum: 0, maximum: 100, description: 'Barbell weight' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  barWeightKg?: number;
}
