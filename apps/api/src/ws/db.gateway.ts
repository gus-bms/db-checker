import {
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';

import { REDIS_CLIENT } from '@/redis/redis.contants';

type SubscriptionPayload = {
  snapshot?: boolean;
  processlist?: boolean;
  timeseries?: boolean;
};

type Subscription = {
  snapshot: boolean;
  processlist: boolean;
  timeseries: boolean;
};

const ROOMS = {
  snapshot: 'sub:snapshot',
  processlist: 'sub:processlist',
  timeseries: 'sub:timeseries',
} as const;

@WebSocketGateway({
  namespace: '/db',
  cors: {
    origin: [
      'http://localhost:5173',
      'https://childrens-neural-collective-confidential.trycloudflare.com',
    ],
    credentials: true,
  },
})
export class DbGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbGateway.name);
  private readonly timeseriesWindowMs = 15 * 60 * 1000;
  private subscriber: Redis | null = null;

  @WebSocketServer()
  private server!: Server;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate();
    this.subscriber.on('message', (channel, message) => {
      void this.handleMessage(channel, message);
    });
    this.subscriber.subscribe('db:pub:snapshot', 'db:pub:processlist');
    this.logger.log('ws subscriber started');
  }

  onModuleDestroy() {
    if (this.subscriber) {
      this.subscriber.unsubscribe('db:pub:snapshot', 'db:pub:processlist');
      this.subscriber.quit();
      this.subscriber = null;
    }
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: SubscriptionPayload,
  ) {
    const sub = normalizeSubscription(payload);
    await this.applyRooms(client, sub);
    await this.pushLatestToClient(client, sub);

    return { ok: true, subscribed: sub };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: SubscriptionPayload,
  ) {
    const sub = normalizeSubscription(payload);
    const wantsAll = !payload;
    const tasks: Promise<void>[] = [];

    if (wantsAll || sub.snapshot)
      tasks.push(Promise.resolve(client.leave(ROOMS.snapshot)));
    if (wantsAll || sub.processlist)
      tasks.push(Promise.resolve(client.leave(ROOMS.processlist)));
    if (wantsAll || sub.timeseries)
      tasks.push(Promise.resolve(client.leave(ROOMS.timeseries)));

    await Promise.all(tasks);

    return { ok: true };
  }

  private hasSubscribers(room: string) {
    const adapter =
      (this.server as unknown as { adapter?: { rooms?: Map<string, Set<string>> } })
        ?.adapter ?? this.server?.sockets?.adapter;
    if (!adapter?.rooms) return false;
    return (adapter.rooms.get(room)?.size ?? 0) > 0;
  }

  private async handleMessage(channel: string, message: string) {
    if (!this.server) return;

    if (channel === 'db:pub:snapshot') {
      const wantsSnapshot = this.hasSubscribers(ROOMS.snapshot);
      const wantsTimeseries = this.hasSubscribers(ROOMS.timeseries);
      if (!wantsSnapshot && !wantsTimeseries) return;

      const payload = { snapshot: safeJsonParse(message) };
      if (wantsSnapshot && wantsTimeseries) {
        this.server
          .to([ROOMS.snapshot, ROOMS.timeseries])
          .emit('db:snapshot', payload);
      } else if (wantsSnapshot) {
        this.server.to(ROOMS.snapshot).emit('db:snapshot', payload);
      } else if (wantsTimeseries) {
        this.server.to(ROOMS.timeseries).emit('db:snapshot', payload);
      }
    }

    if (channel === 'db:pub:processlist') {
      if (!this.hasSubscribers(ROOMS.processlist)) return;
      this.server
        .to(ROOMS.processlist)
        .emit('db:processlist', { processlist: safeJsonParse(message) });
    }
  }

  private async pushLatestToClient(client: Socket, sub: Subscription) {
    if (sub.snapshot) {
      const snapshotStr = await this.redis.get('db:latest:snapshot');
      if (snapshotStr) {
        client.emit('db:snapshot', { snapshot: safeJsonParse(snapshotStr) });
      }
    }

    if (sub.processlist) {
      const processStr = await this.redis.get('db:latest:processlist');
      if (processStr) {
        client.emit('db:processlist', {
          processlist: safeJsonParse(processStr),
        });
      }
    }

    if (sub.timeseries) {
      const payload = await this.fetchTimeseries();
      client.emit('db:timeseries', payload);
    }
  }

  private async fetchTimeseries() {
    const toMs = Date.now();
    const fromMs = toMs - this.timeseriesWindowMs;
    const members = await this.redis.zrangebyscore(
      'db:ts:snapshot',
      fromMs,
      toMs,
    );
    const items = members.map(safeJsonParse);
    return {
      from: fromMs,
      to: toMs,
      count: items.length,
      items,
    };
  }

  private async applyRooms(client: Socket, sub: Subscription) {
    const tasks: Promise<void>[] = [];

    tasks.push(
      Promise.resolve(
        sub.snapshot ? client.join(ROOMS.snapshot) : client.leave(ROOMS.snapshot),
      ),
    );
    tasks.push(
      Promise.resolve(
        sub.processlist
          ? client.join(ROOMS.processlist)
          : client.leave(ROOMS.processlist),
      ),
    );
    tasks.push(
      Promise.resolve(
        sub.timeseries
          ? client.join(ROOMS.timeseries)
          : client.leave(ROOMS.timeseries),
      ),
    );

    await Promise.all(tasks);
  }
}

function normalizeSubscription(payload?: SubscriptionPayload): Subscription {
  return {
    snapshot: Boolean(payload?.snapshot),
    processlist: Boolean(payload?.processlist),
    timeseries: Boolean(payload?.timeseries),
  };
}

function safeJsonParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
