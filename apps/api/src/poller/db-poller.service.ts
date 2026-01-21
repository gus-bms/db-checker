import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '@/redis/redis.contants';
import { DbSnapshotService } from '../api/db-snapshot.service';
import { DbProcesslistService } from '../api/db-processlist.service';

@Injectable()
export class DbPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbPollerService.name);
  private timer: NodeJS.Timeout | null = null;

  // MVP 고정값
  private readonly intervalMs = 5000;
  private readonly latestTtlSec = 15; // interval(5s) * 3
  private readonly windowMs = 60 * 60 * 1000; // 1h

  // processlist 수집 옵션(MVP)
  private readonly processOpts = {
    limit: 80,
    includeSleep: false,
    minTimeSec: 0,
    maxSqlLen: 2000,
  };

  constructor(
    private readonly snapshotService: DbSnapshotService,
    private readonly processlistService: DbProcesslistService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    // 기동 직후 1회 실행 + interval
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.logger.log(`poller started (interval=${this.intervalMs}ms)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    const started = Date.now();

    try {
      const [snapshot, processlist] = await Promise.all([
        this.snapshotService.getSnapshot(),
        this.processlistService.getProcesslist(this.processOpts),
      ]);

      const tsMs = snapshot?.ts ? Date.parse(snapshot.ts) : Date.now();
      const now = Date.now();
      const minScore = now - this.windowMs;

      const snapshotJson = JSON.stringify(snapshot);
      const processJson = JSON.stringify(processlist);

      const p = this.redis.pipeline();

      // latest
      p.set('db:latest:snapshot', snapshotJson, 'EX', this.latestTtlSec);
      p.set('db:latest:processlist', processJson, 'EX', this.latestTtlSec);

      // timeseries (snapshot only)
      p.zadd('db:ts:snapshot', tsMs, snapshotJson);
      p.zremrangebyscore('db:ts:snapshot', '-inf', minScore);

      await p.exec();

      this.logger.debug(`tick ok (${Date.now() - started}ms)`);
    } catch (e: any) {
      this.logger.error(
        `tick failed (${Date.now() - started}ms)`,
        e?.stack || e,
      );
    }
  }
}
