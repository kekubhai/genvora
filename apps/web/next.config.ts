import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Turborepo monorepo: allow importing from packages/*
  transpilePackages: ["@repo/shared-types"],
  experimental: {
    // App router is stable in Next 14 but keep this for any edge features
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry build-time config
  silent: !process.env["CI"],
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  // If SENTRY_DSN is not set, Sentry will be no-op
  autoInstrumentServerFunctions: true,
});
