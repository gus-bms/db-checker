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
  private readonly lockKey = 'db:poller:lock';
  private readonly lockTtlMs = 8000; // slightly longer than interval
  private readonly instanceId = `${process.pid}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

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
      const acquireOrRefresh = `
        local key = KEYS[1]
        local owner = ARGV[1]
        local ttl = tonumber(ARGV[2])

        local cur = redis.call("GET", key)

        if cur == owner then
          -- 내가 리더면 갱신
          return redis.call("PEXPIRE", key, ttl)  -- 1 or 0
        end

        -- 리더가 아니면 선점 시도
        local ok = redis.call("SET", key, owner, "PX", ttl, "NX")
        if ok then
          return 1
        else
          return 0
        end
      `;
      const ok = await this.redis.eval(
        acquireOrRefresh,
        1,
        this.lockKey,
        this.instanceId,
        String(this.lockTtlMs),
      );
      if (Number(ok) !== 1) {
        this.logger.debug('tick skipped (lock not acquired)');
        return;
      }

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

      // pub/sub
      p.publish('db:pub:snapshot', snapshotJson);
      p.publish('db:pub:processlist', processJson);

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
