import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ActivityEntry, JwtAccessPayload } from '@fitness/contracts';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { CurrentUser } from '../../../auth/current-user.decorator';
import { ActivityService } from '../application/activity.service';
import { ListActivityQueryDto } from './dto/activity.dto';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @ApiOperation({ summary: "The user's latest changes and where they came from, newest first" })
  list(
    @CurrentUser() user: JwtAccessPayload,
    @Query() query: ListActivityQueryDto,
  ): Promise<ActivityEntry[]> {
    return this.activity.recent(user.sub, query.limit);
  }
}
