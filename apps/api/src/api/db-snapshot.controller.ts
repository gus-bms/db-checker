import { Controller, Get } from '@nestjs/common';
import { DbSnapshotService } from './db-snapshot.service';

@Controller('db')
export class DbSnapshotController {
  constructor(private readonly svc: DbSnapshotService) {}

  @Get('snapshot')
  async snapshot() {
    // (전역 ResponseEnvelopeInterceptor가 있다면 이 값이 data로 감싸질 것)
    return this.svc.getSnapshot();
  }
}
