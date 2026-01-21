import { Controller, Get, Inject } from '@nestjs/common';
import { MYSQL_RUNNER } from '../connectors/mysql/mysql.tokens';
import { MysqlQueryRunner } from '../connectors/mysql/mysql.query-runner';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.contants';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(MYSQL_RUNNER) private readonly mysql: MysqlQueryRunner,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('/check')
  async mysqlHealth() {
    const query = `SELECT * FROM users where cid = 13361 and uclass = 'B'`;
    const row = await this.mysql.queryOne<{ now: string }>(query);
    return { ok: true, row };
  }

  @Get('redis')
  async redisHealth() {
    const pong = await this.redis.ping();
    return { ok: pong === 'PONG', pong };
  }
}
