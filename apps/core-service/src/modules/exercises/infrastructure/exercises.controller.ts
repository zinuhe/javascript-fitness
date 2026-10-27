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
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Exercise, JwtAccessPayload, Paginated } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { ActivityService } from '../../activity/application/activity.service';
import { ExercisesService } from '../application/exercises.service';
import { CreateExerciseDto, ListExercisesQueryDto, UpdateExerciseDto } from './dto/exercise.dto';

@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly exercises: ExercisesService,
    private readonly activity: ActivityService,
  ) {}

  private log(userId: string, action: string, summary: string, userAgent?: string) {
    return this.activity.record({ userId, action, summary, userAgent });
  }

  @Post()
  @ApiOperation({ summary: 'Create an exercise in the catalog' })
  async create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: CreateExerciseDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Exercise> {
    const exercise = await this.exercises.create(dto);
    await this.log(user.sub, 'exercise.create', `Added exercise ${exercise.name}`, userAgent);
    return exercise;
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
  async update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Exercise> {
    const exercise = await this.exercises.update(id, dto);
    await this.log(user.sub, 'exercise.update', `Edited exercise ${exercise.name}`, userAgent);
    return exercise;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an exercise' })
  async remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    const exercise = await this.exercises.getById(id);
    await this.exercises.remove(id);
    await this.log(user.sub, 'exercise.delete', `Deleted exercise ${exercise.name}`, userAgent);
  }
}
