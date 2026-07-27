import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Exercise, Paginated } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { ExercisesService } from '../application/exercises.service';
import { CreateExerciseDto, ListExercisesQueryDto, UpdateExerciseDto } from './dto/exercise.dto';

@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Post()
  @ApiOperation({ summary: 'Create an exercise in the catalog' })
  create(@Body() dto: CreateExerciseDto): Promise<Exercise> {
    return this.exercises.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List exercises (paginated)' })
  list(@Query() query: ListExercisesQueryDto): Promise<Paginated<Exercise>> {
    return this.exercises.list(query.page, query.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an exercise by id' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Exercise> {
    return this.exercises.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an exercise' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
  ): Promise<Exercise> {
    return this.exercises.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an exercise' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.exercises.remove(id);
  }
}
