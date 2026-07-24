"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        if (result.error.status === 409 || result.error.code === "USER_ALREADY_EXISTS") {
          setError("An account with this email already exists.");
        } else {
          setError(result.error.message ?? "Sign-up failed. Please try again.");
        }
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Could not reach the auth service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f8fa] text-[#16181d] lg:grid-cols-[1fr_480px]">
      <section className="hidden border-r border-[#dfe4ea] p-8 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Genvora
        </Link>
        <div className="max-w-lg">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#2b7a78]">
            Supabase synced
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Create your workspace identity.
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#52606d]">
            New users are created through Better Auth and persisted in the
            migrated Supabase Postgres schema.
          </p>
        </div>
        <p className="break-all text-xs text-[#667085]">{API_URL}</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Genvora
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
            <p className="mt-2 text-sm text-[#667085]">
              Start scanning and tracking AI visibility.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-[#f0b8b8] bg-[#fff5f5] p-3 text-sm text-[#9b2c2c]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSignUp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-[#c9d2dc] bg-white px-3 text-sm outline-none transition focus:border-[#2b7a78] focus:ring-2 focus:ring-[#c7ece2]"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-[#c9d2dc] bg-white px-3 text-sm outline-none transition focus:border-[#2b7a78] focus:ring-2 focus:ring-[#c7ece2]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block h-11 w-full rounded-md border border-[#c9d2dc] bg-white px-3 text-sm outline-none transition focus:border-[#2b7a78] focus:ring-2 focus:ring-[#c7ece2]"
                placeholder="At least 8 characters"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "h-11 w-full rounded-md bg-[#17202a] px-4 text-sm font-semibold text-white transition-colors",
                loading ? "cursor-not-allowed opacity-60" : "hover:bg-[#253241]",
              )}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#667085]">
            Already registered?{" "}
            <Link href="/sign-in" className="font-medium text-[#17202a] underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
