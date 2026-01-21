import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.contants';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const host = process.env.REDIS_HOST ?? '127.0.0.1';
        const port = Number(process.env.REDIS_PORT ?? 6379);
        const db = Number(process.env.REDIS_DB ?? 0);

        const client = new Redis({
          host,
          port,
          db,
          // 실무 기본값: 잠깐 끊겨도 재연결
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        });

        client.on('connect', () => console.log('[REDIS] connect'));
        client.on('ready', () => console.log('[REDIS] ready'));
        client.on('error', (e) => console.error('[REDIS] error', e));
        client.on('close', () => console.warn('[REDIS] close'));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
