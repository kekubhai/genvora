/**
 * Validates that all required environment variables are present and non-empty.
 * On Node.js, logs the first missing variable to stderr and exits with code 1.
 * On Cloudflare Workers, throws an error.
 */

const REQUIRED_API_ENV_VARS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_API_ENV_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const isWorkers = typeof globalThis?.navigator !== "undefined";

    if (isWorkers) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`,
      );
    }

    for (const key of missing) {
      process.stderr.write(
        JSON.stringify({
          level: "error",
          message: `Missing required environment variable: ${key}`,
          variable: key,
          timestamp: new Date().toISOString(),
        }) + "\n",
      );
    }
    process.exit(1);
  }
}
