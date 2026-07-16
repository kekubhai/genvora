import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import type { HealthStatus } from "@repo/shared-types";

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthStatus> {
    const [postgresStatus, redisStatus] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const allHealthy = postgresStatus === "connected" && redisStatus === "connected";

    return {
      status: allHealthy ? "ok" : "degraded",
      dependencies: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };
  }

  private async checkPostgres(): Promise<"connected" | "unavailable"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "connected";
    } catch {
      return "unavailable";
    }
  }

  private checkRedis(): "connected" | "unavailable" {
    return this.redis.isHealthy ? "connected" : "unavailable";
  }
}
