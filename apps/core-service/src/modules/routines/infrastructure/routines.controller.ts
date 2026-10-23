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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { JwtAccessPayload, NextRoutineDay, Routine } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { RoutinesService } from '../application/routines.service';
import { RoutineDto } from './dto/routine.dto';

@ApiTags('routines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routines: RoutinesService) {}

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
  create(@CurrentUser() user: JwtAccessPayload, @Body() dto: RoutineDto): Promise<Routine> {
    return this.routines.create(user.sub, dto);
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
  update(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RoutineDto,
  ): Promise<Routine> {
    return this.routines.update(user.sub, id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Make this the active routine' })
  activate(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Routine> {
    return this.routines.activate(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a routine (its workouts are kept)' })
  remove(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.routines.remove(user.sub, id);
  }
}
