import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: any = null;

  constructor() {}

  async onModuleInit(): Promise<void> {
    try {
      // Standard PrismaClient works on this Worker with nodejs_compat.
      // The pg Pool adapter has been observed to hang on $connect in production.
      const { PrismaClient } = await import("@prisma/client");
      this.client = new PrismaClient({
        log: ["error"],
      });
      await this.client.$connect();
      this.logger.log("Connected to Postgres via Prisma");
    } catch (err) {
      const msg = "Failed to connect to Postgres on startup";

      process.stderr.write(
        JSON.stringify({
          level: "error",
          dependency: "postgres",
          message: msg,
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }) + "\n",
      );

      this.logger.error(msg);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
    }
  }

  // Proxy all PrismaClient methods
  get scan() { return this.client?.scan; }
  get categoryScore() { return this.client?.categoryScore; }
  get recommendation() { return this.client?.recommendation; }
  get user() { return this.client?.user; }
  get session() { return this.client?.session; }
  get account() { return this.client?.account; }
  get organization() { return this.client?.organization; }
  get member() { return this.client?.member; }
  get invitation() { return this.client?.invitation; }
  get site() { return this.client?.site; }
  get verification() { return this.client?.verification; }

  async $queryRaw(query: TemplateStringsArray, ...values: unknown[]) {
    return this.client?.$queryRaw(query, ...values);
  }

  async $connect() {
    return this.client?.$connect();
  }

  async $disconnect() {
    return this.client?.$disconnect();
  }
}
