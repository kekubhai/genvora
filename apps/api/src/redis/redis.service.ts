import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private _isHealthy = false;

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  async onModuleInit(): Promise<void> {
    // Redis is not available on Cloudflare Workers.
    // On Node.js (local dev / Docker), connect if REDIS_URL is set.
    const redisUrl = process.env["REDIS_URL"];

    if (!redisUrl || typeof globalThis?.navigator !== "undefined") {
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "Redis unavailable — running in degraded mode",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      const ioredis = await import("ioredis");
      const RedisConstructor = (ioredis as any).default ?? ioredis;
      const client = new RedisConstructor(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      client.on("error", (err: Error) => {
        this._isHealthy = false;
        this.logger.warn(
          JSON.stringify({
            level: "warn",
            message: "Redis connection error",
            error: err.message,
            timestamp: new Date().toISOString(),
          }),
        );
      });

      await client.connect();
      this._isHealthy = true;
      this.logger.log("Connected to Redis");
    } catch (err) {
      this._isHealthy = false;
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "Failed to connect to Redis — running in degraded mode",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    // No-op on Cloudflare Workers
  }
}
