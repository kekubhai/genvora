import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

const apiUrl = process.env["NEXT_PUBLIC_API_URL"];

if (!apiUrl && typeof window !== "undefined") {
  console.warn("NEXT_PUBLIC_API_URL is not set — auth requests may fail");
}

export const authClient = createAuthClient({
  baseURL: apiUrl ?? "http://localhost:3001",
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
