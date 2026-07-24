// Sentry is a no-op on Cloudflare Workers (no @sentry/node support)
const isWorkers = typeof globalThis?.navigator !== "undefined";

if (!isWorkers) {
  const dsn = process.env["SENTRY_DSN"];

  if (!dsn) {
    console.warn(
      JSON.stringify({
        level: "warn",
        message: "SENTRY_DSN is not set — Sentry running in no-op mode",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  // Dynamic import to avoid bundling @sentry/node on Workers
  import("@sentry/node").then((Sentry) => {
    Sentry.init({
      dsn: dsn ?? "",
      environment: process.env["NODE_ENV"] ?? "development",
      beforeSend(event) {
        if (event.request?.data) {
          const data = event.request.data as Record<string, unknown>;
          if ("password" in data) data["password"] = "[Filtered]";
          if ("currentPassword" in data) data["currentPassword"] = "[Filtered]";
        }
        if (event.request?.headers) {
          const headers = event.request.headers as Record<string, unknown>;
          if ("authorization" in headers) headers["authorization"] = "[Filtered]";
          if ("Authorization" in headers) headers["Authorization"] = "[Filtered]";
        }
        if (event.request?.cookies) {
          const cookies = event.request.cookies as Record<string, unknown>;
          for (const key of Object.keys(cookies)) {
            if (key.toLowerCase().includes("session") || key.toLowerCase().includes("token")) {
              cookies[key] = "[Filtered]";
            }
          }
        }
        return event;
      },
    });
  }).catch(() => {
    // @sentry/node not available (Workers environment) — silently skip
  });
}
