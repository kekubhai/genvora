import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log("Connected to Postgres via Prisma");
    } catch (err) {
      // Emit structured log and exit — database is a hard dependency
      process.stderr.write(
        JSON.stringify({
          level: "error",
          dependency: "postgres",
          message: "Failed to connect to Postgres on startup",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }) + "\n",
      );
      process.exit(1);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
