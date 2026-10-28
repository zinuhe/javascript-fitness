import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Equipment } from '@fitness/contracts';
import type {
  CreateSetRequest,
  CreateWorkoutExerciseRequest,
  CreateWorkoutRequest,
  UpdateWorkoutRequest,
} from '@fitness/contracts';

export class CreateSetDto implements CreateSetRequest {
  @ApiProperty({ example: 8, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1000)
  reps!: number;

  // Upper bound mirrors the DECIMAL(6,2) column so out-of-range values fail validation.
  @ApiProperty({ example: 80, minimum: 0, maximum: 9999.99 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  weightKg!: number;

  @ApiPropertyOptional({ example: 8, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  rpe?: number;

  @ApiPropertyOptional({ example: 120, minimum: 0, maximum: 3600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  restSeconds?: number;
}

export class CreateWorkoutExerciseDto implements CreateWorkoutExerciseRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  exerciseId!: string;

  @ApiPropertyOptional({
    enum: Equipment,
    description: 'Equipment used; required when the exercise has more than one',
  })
  @IsOptional()
  @IsEnum(Equipment)
  equipment?: Equipment;

  @ApiPropertyOptional({
    example: 12.5,
    minimum: 0,
    maximum: 100,
    description: 'Barbell weight already included in each set weight; barbell only',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  barKg?: number;

  @ApiPropertyOptional({
    enum: [1, 2],
    description: 'How many dumbbells were used; dumbbell only, 2 when left out',
  })
  @IsOptional()
  @IsIn([1, 2])
  dumbbells?: number;

  @ApiProperty({ type: [CreateSetDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSetDto)
  sets!: CreateSetDto[];
}

export class CreateWorkoutDto implements CreateWorkoutRequest {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  performedAt?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Routine day this session follows' })
  @IsOptional()
  @IsUUID()
  routineDayId?: string;

  @ApiProperty({ type: [CreateWorkoutExerciseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkoutExerciseDto)
  exercises!: CreateWorkoutExerciseDto[];
}

export class UpdateWorkoutDto
  extends OmitType(CreateWorkoutDto, ['routineDayId'] as const)
  implements UpdateWorkoutRequest
{
  // @IsOptional also lets null through: null unlinks the routine day, omitted keeps it.
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Routine day this session follows; null unlinks it, omitted keeps it',
  })
  @IsOptional()
  @IsUUID()
  routineDayId?: string | null;
}

export class ListWorkoutsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ format: 'date-time', description: 'Only workouts performed from then' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Only workouts performed before then' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class LastSetsQueryDto {
  @ApiProperty({ description: 'Comma-separated exercise ids', example: 'uuid-1,uuid-2' })
  @Transform(({ value }: { value: unknown }) =>
    String(value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  exerciseIds!: string[];
}

export class ProgressQueryDto {
  @ApiPropertyOptional({ enum: Equipment, description: 'Only sets done with this equipment' })
  @IsOptional()
  @IsEnum(Equipment)
  equipment?: Equipment;
}
