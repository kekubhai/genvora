import "reflect-metadata"; // Required for NestJS decorators
import "./instrument"; // Sentry must be imported first (after reflect-metadata)
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";

async function bootstrap() {
  // Validate required env vars before anything else — exit with non-zero if missing
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  const allowedOrigins = (process.env["FRONTEND_URL"] ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = parseInt(process.env["PORT"] ?? "3001", 10);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Fatal startup error",
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    }),
  );
  process.exit(1);
});
