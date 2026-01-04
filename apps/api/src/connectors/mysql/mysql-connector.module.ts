import { Module } from '@nestjs/common';
import { createPool, type Pool } from 'mysql2/promise';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { Env } from '@/types/env';
import { MYSQL_POOL, MYSQL_RUNNER } from './mysql.tokens';
import { MysqlQueryRunner } from './mysql.query-runner';

type RequiredEnvKeys = 'DB_HOST' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME';

function requireEnvString(
  config: ConfigService, // 굳이 제네릭에 기대지 않음(버전/설정에 흔들리지 않게)
  key: RequiredEnvKeys,
): string {
  const v = config.get<unknown>(key);
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing or invalid env: ${key}`);
  }
  return v;
}

function envNumber(
  config: ConfigService,
  key: keyof Env,
  fallback: number,
): number {
  const v = config.get<unknown>(key as string);
  if (v == null || v === '') return fallback;

  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number env: ${String(key)}`);
  }
  return n;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MYSQL_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        const pool = createPool({
          host: requireEnvString(config, 'DB_HOST'),
          port: envNumber(config, 'DB_PORT', 3306),
          user: requireEnvString(config, 'DB_USER'),
          password: requireEnvString(config, 'DB_PASSWORD'),
          database: requireEnvString(config, 'DB_NAME'),

          waitForConnections: true,
          connectionLimit: envNumber(config, 'DB_POOL_LIMIT', 5),
          connectTimeout: envNumber(config, 'DB_CONNECT_TIMEOUT_MS', 1500),

          enableKeepAlive: true,
          keepAliveInitialDelay: 0,
        });

        return pool;
      },
    },
    {
      provide: MYSQL_RUNNER,
      inject: [MYSQL_POOL, ConfigService],
      useFactory: (pool: Pool, config: ConfigService) => {
        return new MysqlQueryRunner(pool, {
          queryTimeoutMs: envNumber(config, 'DB_QUERY_TIMEOUT_MS', 1200),
        });
      },
    },
  ],
  exports: [MYSQL_POOL, MYSQL_RUNNER],
})
export class MysqlConnectorModule {}
