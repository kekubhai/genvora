import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private _isHealthy = false;

  get isHealthy(): boolean {
    return this._isHealthy;
  }

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env["REDIS_URL"];

    if (!redisUrl) {
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "REDIS_URL is not set — Redis running in degraded mode",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      });

      // Register error handler before connect so errors don't throw unhandled rejections
      this.client.on("error", (err: Error) => {
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

      await this.client.connect();
      this._isHealthy = true;
      this.logger.log("Connected to Redis");
    } catch (err) {
      this._isHealthy = false;
      // Redis is not a hard dependency — log warning and continue in degraded mode
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "Failed to connect to Redis — API running in degraded mode",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis | null {
    return this.client;
  }
}
