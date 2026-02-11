import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '@/redis/redis.contants';
import { getThresholdsFromEnv } from './thresholds';

type AlertLevel = 'warn' | 'critical';

type AlertMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  warn: number;
  critical: number;
};

@Injectable()
export class NotificatorService {
  private readonly logger = new Logger(NotificatorService.name);
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;
  private readonly cooldownSec = numEnv('NOTI_COOLDOWN_SEC', 60);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async notifySnapshot(snapshot: any) {
    if (!this.webhookUrl) return;
    if (!snapshot) return;

    const alerts = this.buildAlerts(snapshot);
    if (!alerts.length) return;

    const eligible = await this.filterCooldown(alerts);
    if (!eligible.length) return;

    const level = pickTopLevel(eligible.map((a) => a.level));
    const ts = snapshot.ts ?? new Date().toISOString();

    const lines = eligible.map(
      (a) =>
        `• ${a.label}: ${a.value}${a.unit ?? ''} (warn ${a.warn}${
          a.unit ?? ''
        }, critical ${a.critical}${a.unit ?? ''})`,
    );

    const title = `DB Alert (${level.toUpperCase()})`;
    const body = [`time: ${ts}`, ...lines].join('\n');

    await this.postSlack(level, title, body);
  }

  private buildAlerts(snapshot: any) {
    const connUsage = Number(snapshot?.connections?.conn_usage_pct ?? 0);
    const threadsRunning = Number(snapshot?.connections?.threads_running ?? 0);
    const lockWaits = Number(
      snapshot?.innodb_locks?.row_lock_current_waits ?? 0,
    );
    const slowQueries = Number(snapshot?.traffic?.slow_queries ?? 0);

    const thresholds = getThresholdsFromEnv();

    const metrics: AlertMetric[] = [
      {
        key: 'conn_usage_pct',
        label: 'Connection usage',
        value: Number.isFinite(connUsage) ? connUsage : 0,
        unit: '%',
        warn: thresholds.conn_usage_pct.warn,
        critical: thresholds.conn_usage_pct.critical,
      },
      {
        key: 'threads_running',
        label: 'Threads running',
        value: Number.isFinite(threadsRunning) ? threadsRunning : 0,
        warn: thresholds.threads_running.warn,
        critical: thresholds.threads_running.critical,
      },
      {
        key: 'row_lock_current_waits',
        label: 'Row lock waits (current)',
        value: Number.isFinite(lockWaits) ? lockWaits : 0,
        warn: thresholds.row_lock_current_waits.warn,
        critical: thresholds.row_lock_current_waits.critical,
      },
      {
        key: 'slow_queries',
        label: 'Slow queries',
        value: Number.isFinite(slowQueries) ? slowQueries : 0,
        warn: thresholds.slow_queries.warn,
        critical: thresholds.slow_queries.critical,
      },
    ];

    return metrics
      .map((m) => ({ ...m, level: levelFor(m.value, m.warn, m.critical) }))
      .filter((m) => m.level !== null) as Array<
      AlertMetric & { level: AlertLevel }
    >;
  }

  private async filterCooldown(
    alerts: Array<AlertMetric & { level: AlertLevel }>,
  ) {
    const eligible: Array<AlertMetric & { level: AlertLevel }> = [];

    for (const alert of alerts) {
      const key = `noti:db:${alert.key}:${alert.level}`;
      const ok = await this.redis.set(key, '1', 'EX', this.cooldownSec, 'NX');
      if (ok === 'OK') eligible.push(alert);
    }

    return eligible;
  }

  private async postSlack(level: AlertLevel, title: string, body: string) {
    try {
      const color = level === 'critical' ? '#ef4444' : '#f59e0b';
      const res = await fetch(this.webhookUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color,
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: title,
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: body,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        this.logger.warn(`slack notify failed (${res.status})`);
      }
    } catch (e: any) {
      this.logger.warn('slack notify error', e?.stack || e);
    }
  }
}

function numEnv(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function levelFor(
  value: number,
  warn: number,
  critical: number,
): AlertLevel | null {
  if (value >= critical) return 'critical';
  if (value >= warn) return 'warn';
  return null;
}

function pickTopLevel(levels: AlertLevel[]) {
  return levels.includes('critical') ? 'critical' : 'warn';
}
