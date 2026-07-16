import * as Sentry from "@sentry/nextjs";

const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

Sentry.init({
  dsn: dsn ?? "", // empty string = no-op when DSN not set
  environment: process.env["NODE_ENV"] ?? "production",
  tracesSampleRate: 0.1,
  // Capture replay for error sessions only
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [
    Sentry.replayIntegration(),
  ],
});
