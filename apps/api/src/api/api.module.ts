import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DbResourcesController } from './db-resources.controller';
import { DbResourcesService } from './db-resources.service';
import { MysqlConnectorModule } from '@/connectors/mysql/mysql-connector.module';

@Module({
  imports: [MysqlConnectorModule],
  controllers: [HealthController, DbResourcesController],
  providers: [DbResourcesService],
})
export class ApiModule {}
