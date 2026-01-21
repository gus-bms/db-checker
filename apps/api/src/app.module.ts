import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { MysqlConnectorModule } from './connectors/mysql/mysql-connector.module';
import { ApiModule } from './api/api.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [ConfigModule, MysqlConnectorModule, ApiModule, RedisModule],
})
export class AppModule {}
