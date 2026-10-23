import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ExerciseProgress,
  JwtAccessPayload,
  LastExerciseSets,
  Paginated,
  Workout,
} from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { WorkoutsService } from '../application/workouts.service';
import { CreateWorkoutDto, LastSetsQueryDto, ListWorkoutsQueryDto } from './dto/workout.dto';

@ApiTags('workouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  @Post()
  @ApiOperation({ summary: 'Log a new workout session' })
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateWorkoutDto): Promise<Workout> {
    return this.workouts.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the authenticated user workouts (paginated)' })
  list(
    @CurrentUser() user: JwtAccessPayload,
    @Query() query: ListWorkoutsQueryDto,
  ): Promise<Paginated<Workout>> {
    return this.workouts.list(user.sub, query.page, query.pageSize);
  }

  // Declared before ':id' so "last-sets" is not parsed as a workout id.
  @Get('last-sets')
  @ApiOperation({ summary: 'Sets from the most recent workout of each given exercise' })
  lastSets(
    @CurrentUser() user: JwtAccessPayload,
    @Query() query: LastSetsQueryDto,
  ): Promise<LastExerciseSets[]> {
    return this.workouts.lastSets(user.sub, query.exerciseIds);
  }

  @Get('progress/:exerciseId')
  @ApiOperation({ summary: 'Progress metrics for an exercise over time' })
  progress(
    @CurrentUser() user: JwtAccessPayload,
    @Param('exerciseId', ParseUUIDPipe) exerciseId: string,
  ): Promise<ExerciseProgress> {
    return this.workouts.getExerciseProgress(user.sub, exerciseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one workout by id' })
  get(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Workout> {
    return this.workouts.getById(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Replace a workout: notes and exercises as given; omitted performedAt is kept',
  })
  update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkoutDto,
  ): Promise<Workout> {
    return this.workouts.update(user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workout' })
  remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.workouts.remove(user.sub, id);
  }
}
