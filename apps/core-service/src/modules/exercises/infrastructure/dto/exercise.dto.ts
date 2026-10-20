import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Equipment, MuscleGroup, type CreateExerciseRequest } from '@fitness/contracts';

export class CreateExerciseDto implements CreateExerciseRequest {
  @ApiProperty({ example: 'Barbell Bench Press', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: MuscleGroup, example: MuscleGroup.Chest })
  @IsEnum(MuscleGroup)
  muscleGroup!: MuscleGroup;

  @ApiProperty({ enum: Equipment, example: Equipment.Barbell })
  @IsEnum(Equipment)
  equipment!: Equipment;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {}

export class ListExercisesQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
