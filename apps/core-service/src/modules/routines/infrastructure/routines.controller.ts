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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtAccessPayload, NextRoutineDay, Routine } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { RoutinesService } from '../application/routines.service';
import { ActivityService } from '../../activity/application/activity.service';
import { RoutineDto } from './dto/routine.dto';

@ApiTags('routines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(
    private readonly routines: RoutinesService,
    private readonly activity: ActivityService,
  ) {}

  private log(userId: string, action: string, summary: string, userAgent?: string) {
    return this.activity.record({ userId, action, summary, userAgent });
  }

  @Get()
  @ApiOperation({ summary: "List the user's routines, the active one first" })
  list(@CurrentUser() user: JwtAccessPayload): Promise<Routine[]> {
    return this.routines.list(user.sub);
  }

  // Declared before ':id' so "next" is not parsed as a routine id.
  @Get('next')
  @ApiOperation({ summary: 'The day to do next in the active routine (204 when none is active)' })
  async next(
    @CurrentUser() user: JwtAccessPayload,
    // Only status() is needed; typed structurally (no express dependency here).
    @Res({ passthrough: true }) res: { status(code: number): unknown },
  ): Promise<NextRoutineDay | undefined> {
    const next = await this.routines.next(user.sub);
    if (!next) {
      res.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return next;
  }

  @Post()
  @ApiOperation({ summary: 'Create a routine (the first one becomes active)' })
  async create(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: RoutineDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Routine> {
    const routine = await this.routines.create(user.sub, dto);
    await this.log(user.sub, 'routine.create', `Created routine ${routine.name}`, userAgent);
    return routine;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one routine' })
  get(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Routine> {
    return this.routines.getById(user.sub, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Replace a routine; days are matched by id so their history is kept' })
  async update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RoutineDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Routine> {
    const routine = await this.routines.update(user.sub, id, dto);
    await this.log(user.sub, 'routine.update', `Edited routine ${routine.name}`, userAgent);
    return routine;
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make this the active routine' })
  async activate(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<Routine> {
    const routine = await this.routines.activate(user.sub, id);
    await this.log(user.sub, 'routine.activate', `Activated routine ${routine.name}`, userAgent);
    return routine;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a routine (its workouts are kept)' })
  async remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    const routine = await this.routines.getById(user.sub, id);
    await this.routines.remove(user.sub, id);
    await this.log(user.sub, 'routine.delete', `Deleted routine ${routine.name}`, userAgent);
  }
}
