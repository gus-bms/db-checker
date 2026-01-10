import { Controller, Get, Query } from '@nestjs/common';
import { DbProcesslistService } from './db-processlist.service';

@Controller('db')
export class DbProcesslistController {
  constructor(private readonly svc: DbProcesslistService) {}

  @Get('process-list')
  async processlist(
    @Query('limit') limit?: string,
    @Query('includeSleep') includeSleep?: string,
    @Query('minTimeSec') minTimeSec?: string,
  ) {
    return this.svc.getProcesslist({
      limit: limit ? Number(limit) : 50,
      includeSleep: includeSleep === '1' || includeSleep === 'true',
      minTimeSec: minTimeSec ? Number(minTimeSec) : 0,
      maxSqlLen: 2000,
    });
  }
}
