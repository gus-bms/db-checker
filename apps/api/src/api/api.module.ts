import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbResourcesController } from './db-resources.controller';
import { DbResourcesService } from './db-resources.service';
import { MysqlConnectorModule } from '@/connectors/mysql/mysql-connector.module';
import { DbProcesslistController } from './db-processlist.controller';
import { DbProcesslistService } from './db-processlist.service';
import { DbSnapshotController } from './db-snapshot.controller';
import { DbSnapshotService } from './db-snapshot.service';
import { RedisModule } from '@/redis/redis.module';
import { DbCacheController } from './db-cache.controller';
import { DbPollerService } from '@/poller/db-poller.service';

@Module({
  imports: [MysqlConnectorModule, RedisModule],
  controllers: [
    HealthController,
    DbResourcesController,
    DbProcesslistController,
    DbSnapshotController,
    DbCacheController,
  ],
  providers: [
    DbResourcesService,
    DbProcesslistService,
    DbSnapshotService,
    DbPollerService,
  ],
})
export class ApiModule {}
