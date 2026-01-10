import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbResourcesController } from './db-resources.controller';
import { DbResourcesService } from './db-resources.service';
import { MysqlConnectorModule } from '@/connectors/mysql/mysql-connector.module';
import { DbProcesslistController } from './db-processlist.controller';
import { DbProcesslistService } from './db-processlist.service';
import { DbSnapshotController } from './db-snapshot.controller';
import { DbSnapshotService } from './db-snapshot.service';

@Module({
  imports: [MysqlConnectorModule],
  controllers: [
    HealthController,
    DbResourcesController,
    DbProcesslistController,
    DbSnapshotController,
  ],
  providers: [DbResourcesService, DbProcesslistService, DbSnapshotService],
})
export class ApiModule {}
