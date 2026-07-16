"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env["NEXT_PUBLIC_POSTHOG_KEY"];
    const posthogHost =
      process.env["NEXT_PUBLIC_POSTHOG_HOST"] ?? "https://app.posthog.com";

    if (!posthogKey) {
      // No key — initialize in a way that no events are sent (no-op)
      // posthog-js doesn't send events when not initialized, so we simply skip init
      return;
    }

    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      loaded: (ph) => {
        if (process.env["NODE_ENV"] === "development") {
          ph.debug();
        }
      },
    });
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
