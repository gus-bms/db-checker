import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { MysqlConnectorModule } from './connectors/mysql/mysql-connector.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [ConfigModule, MysqlConnectorModule, ApiModule],
})
export class AppModule {}
