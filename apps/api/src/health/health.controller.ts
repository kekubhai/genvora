import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { HealthService } from "./health.service";
import type { HealthStatus } from "@repo/shared-types";

@Controller("health")
export class HealthController {
  // Explicit @Inject — wrangler/esbuild does not emit design:paramtypes
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const health = await this.healthService.check();

    const isHealthy =
      health.dependencies.postgres === "connected";

    if (!isHealthy) {
      throw new ServiceUnavailableException(health);
    }

    return health;
  }
}
