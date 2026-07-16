/**
 * Validates that all required environment variables are present and non-empty.
 * Writes missing variable name to stderr and exits with non-zero code if any absent.
 */

const REQUIRED_WORKER_ENV_VARS = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_WORKER_ENV_VARS) {
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
