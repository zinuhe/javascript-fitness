import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Exercise, JwtAccessPayload, Paginated } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { ActivityService } from '../../activity/application/activity.service';
import { ExercisesService } from '../application/exercises.service';
import {
  ExerciseImagesService,
  MAX_LARGE_BYTES,
  type UploadedImage,
} from '../application/exercise-images.service';
import { CreateExerciseDto, ListExercisesQueryDto, UpdateExerciseDto } from './dto/exercise.dto';

@ApiTags('exercises')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(
    private readonly exercises: ExercisesService,
    private readonly images: ExerciseImagesService,
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

  @Put(':id/images/:slot')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Set picture 1 (the one shown small) or 2: multipart with `thumb` and `large` files',
  })
  // Kept in memory (they are small, and go straight into the database).
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumb', maxCount: 1 },
        { name: 'large', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_LARGE_BYTES, files: 2, fields: 0 } },
    ),
  )
  async setImage(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', ParseIntPipe) slot: number,
    @UploadedFiles() files: { thumb?: UploadedImage[]; large?: UploadedImage[] } = {},
    @Headers('user-agent') userAgent?: string,
  ): Promise<Exercise> {
    const exercise = await this.images.set(id, slot, {
      thumb: files.thumb?.[0],
      large: files.large?.[0],
    });
    const what = ExerciseImagesService.describeSlot(slot);
    await this.log(user.sub, 'exercise.image', `Set ${what} of ${exercise.name}`, userAgent);
    return exercise;
  }

  @Delete(':id/images/:slot')
  @ApiOperation({ summary: 'Remove picture 1 or 2' })
  async removeImage(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slot', ParseIntPipe) slot: number,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Exercise> {
    const exercise = await this.images.remove(id, slot);
    const what = ExerciseImagesService.describeSlot(slot);
    await this.log(user.sub, 'exercise.image', `Removed ${what} of ${exercise.name}`, userAgent);
    return exercise;
  }
}
