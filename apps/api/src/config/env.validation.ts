/**
 * Validates that all required environment variables are present and non-empty.
 * Logs the first missing variable to stderr and exits with code 1 if any are absent.
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
