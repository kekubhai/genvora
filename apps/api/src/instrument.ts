import * as Sentry from "@sentry/node";

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

Sentry.init({
  dsn: dsn ?? "", // empty string = no-op (events silently dropped)
  environment: process.env["NODE_ENV"] ?? "development",
  // Exclude sensitive data from Sentry payloads
  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      // Scrub password fields
      if ("password" in data) data["password"] = "[Filtered]";
      if ("currentPassword" in data) data["currentPassword"] = "[Filtered]";
    }
    // Scrub Authorization headers
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, unknown>;
      if ("authorization" in headers) headers["authorization"] = "[Filtered]";
      if ("Authorization" in headers) headers["Authorization"] = "[Filtered]";
    }
    // Scrub session tokens from cookies
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
