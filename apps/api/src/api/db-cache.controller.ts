import {
  Controller,
  Get,
  Inject,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@/redis/redis.contants';

@Controller('db')
export class DbCacheController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @Get('latest')
  async getLatest() {
    const [snapshotStr, processStr] = await Promise.all([
      this.redis.get('db:latest:snapshot'),
      this.redis.get('db:latest:processlist'),
    ]);

    if (!snapshotStr || !processStr) {
      throw new ServiceUnavailableException({
        ok: false,
        message: 'Cache is warming up or Redis key expired',
      });
    }

    return {
      ok: true,
      snapshot: safeJsonParse(snapshotStr),
      processlist: safeJsonParse(processStr),
    };
  }

  @Get('timeseries')
  async getTimeseries(@Query('from') from?: string, @Query('to') to?: string) {
    const now = Date.now();
    const toMs = to ? clampNum(Number(to), 0, now) : now;
    const fromMs = from
      ? clampNum(Number(from), 0, toMs)
      : toMs - 15 * 60 * 1000;

    const members = await this.redis.zrangebyscore(
      'db:ts:snapshot',
      fromMs,
      toMs,
    );

    return {
      ok: true,
      from: fromMs,
      to: toMs,
      count: members.length,
      items: members.map(safeJsonParse),
    };
  }
}

function safeJsonParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

function clampNum(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
