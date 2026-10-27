import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import { ActivityService } from '../../activity/application/activity.service';
import { workoutSummary } from '../../activity/application/summaries';
import {
  CreateWorkoutDto,
  LastSetsQueryDto,
  ListWorkoutsQueryDto,
  ProgressQueryDto,
  UpdateWorkoutDto,
} from './dto/workout.dto';

@ApiTags('workouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workouts')
export class WorkoutsController {
  constructor(
    private readonly workouts: WorkoutsService,
    private readonly activity: ActivityService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Log a new workout session' })
  async create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateWorkoutDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Workout> {
    const workout = await this.workouts.create(user.sub, dto);
    await this.activity.record({
      userId: user.sub,
      action: 'workout.create',
      summary: workoutSummary('Added', workout),
      subjectAt: workout.performedAt,
      userAgent,
    });
    return workout;
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
  @ApiOperation({
    summary: 'Sets from the most recent workout of each given exercise, per equipment used',
  })
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
    @Query() query: ProgressQueryDto,
  ): Promise<ExerciseProgress> {
    return this.workouts.getExerciseProgress(user.sub, exerciseId, query.equipment);
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
    summary:
      'Replace a workout: notes and exercises as given; omitted performedAt and routineDayId are kept, routineDayId null unlinks it',
  })
  async update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkoutDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Workout> {
    const workout = await this.workouts.update(user.sub, id, dto);
    await this.activity.record({
      userId: user.sub,
      action: 'workout.update',
      summary: workoutSummary('Edited', workout),
      subjectAt: workout.performedAt,
      userAgent,
    });
    return workout;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workout' })
  async remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    // Read first: once deleted, its date and routine day are gone.
    const workout = await this.workouts.getById(user.sub, id);
    await this.workouts.remove(user.sub, id);
    await this.activity.record({
      userId: user.sub,
      action: 'workout.delete',
      summary: workoutSummary('Deleted', workout),
      subjectAt: workout.performedAt,
      userAgent,
    });
  }
}
