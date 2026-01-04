import { Controller, Get } from '@nestjs/common';
import { DbResourcesService } from './db-resources.service';

@Controller('db')
export class DbResourcesController {
  constructor(private readonly svc: DbResourcesService) {}

  @Get('resources')
  async resources() {
    return this.svc.getResources();
  }
}
