import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: any = null;

  constructor() {}

  async onModuleInit(): Promise<void> {
    try {
      const isWorkers = typeof globalThis?.navigator !== "undefined";

      if (isWorkers) {
        // Cloudflare Workers: use @prisma/adapter-pg
        const { PrismaClient } = await import("@prisma/client");
        const { PrismaPg } = await import("@prisma/adapter-pg");
        const { Pool } = await import("pg");
        const pool = new Pool({
          connectionString: process.env["DATABASE_URL"] ?? "",
        });
        const adapter = new PrismaPg(pool);
        this.client = new PrismaClient({
          adapter: adapter as any,
          log: ["error"],
        });
      } else {
        // Node.js (local dev / Docker): use standard PrismaClient
        const { PrismaClient } = await import("@prisma/client");
        this.client = new PrismaClient({
          log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
        });
      }

      await this.client.$connect();
      this.logger.log("Connected to Postgres via Prisma");
    } catch (err) {
      const isWorkers = typeof globalThis?.navigator !== "undefined";
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

      if (isWorkers) {
        throw new Error(msg);
      }
      process.exit(1);
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
