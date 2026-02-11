import { Controller, Get } from '@nestjs/common';
import { getThresholdsFromEnv } from '@/notifications/thresholds';

@Controller('config')
export class ConfigController {
  @Get('thresholds')
  getThresholds() {
    return getThresholdsFromEnv();
  }
}
