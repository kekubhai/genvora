import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/shared-types"],
  experimental: {},
};

export default withSentryConfig(nextConfig, {
  silent: !process.env["CI"],
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  autoInstrumentServerFunctions: true,
});
