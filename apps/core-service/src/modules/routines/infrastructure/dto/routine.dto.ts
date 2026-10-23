import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { CreateRoutineRequest, RoutineDayInput } from '@fitness/contracts';

export class RoutineDayDto implements RoutineDayInput {
  @ApiPropertyOptional({ format: 'uuid', description: 'Existing day to keep; omit for a new one' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 'Push', maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'Exercises in order' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  exerciseIds!: string[];
}

export class RoutineDto implements CreateRoutineRequest {
  @ApiProperty({ example: 'Push / Pull / Legs', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ type: [RoutineDayDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => RoutineDayDto)
  days!: RoutineDayDto[];
}
