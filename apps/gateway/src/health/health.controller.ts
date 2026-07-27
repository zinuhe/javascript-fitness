import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Gateway liveness' })
  live() {
    return this.health.check([]);
  }
}
