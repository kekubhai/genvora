import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { API_URL } from "./api";

if (!process.env["NEXT_PUBLIC_API_URL"] && typeof window !== "undefined") {
  console.warn("NEXT_PUBLIC_API_URL is not set — auth requests may fail");
}

export const authClient = createAuthClient({
  baseURL: API_URL,
  // Must match server basePath in apps/api (default client path is /api/auth)
  basePath: "/auth",
  plugins: [organizationClient()],
});

// Convenience re-exports
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
} = authClient;
