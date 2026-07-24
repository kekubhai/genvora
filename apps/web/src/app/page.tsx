import Link from "next/link";
import { API_URL } from "@/lib/api";

const metrics = [
  ["API", "Cloudflare Workers"],
  ["Auth", "Better Auth"],
  ["Data", "Supabase Postgres"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#16181d]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-5">
        <header className="flex items-center justify-between border-b border-[#dfe4ea] pb-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Genvora
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-md px-3 py-2 text-sm font-medium text-[#4b5563] hover:bg-white"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-[#17202a] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#253241]"
            >
              Create account
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1fr_420px]">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-[#2b7a78]">
              AI visibility operations
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#101418] sm:text-5xl">
              Audit how your website appears to AI systems.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#52606d]">
              Genvora gives teams a focused workspace for scanning domains,
              reviewing structured findings, and turning recommendations into
              search and AI-readiness fixes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-md bg-[#17202a] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#253241]"
              >
                Open dashboard
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md border border-[#c9d2dc] bg-white px-5 py-3 text-sm font-semibold text-[#17202a] hover:border-[#9aa8b5]"
              >
                Start with auth
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#edf0f3] pb-4">
              <div>
                <h2 className="text-sm font-semibold text-[#101418]">
                  Deployment Status
                </h2>
                <p className="mt-1 text-xs text-[#667085]">Production backend</p>
              </div>
              <span className="rounded-full bg-[#dff7ed] px-2.5 py-1 text-xs font-medium text-[#156447]">
                Live
              </span>
            </div>

            <dl className="mt-4 space-y-3">
              {metrics.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md bg-[#f7f8fa] px-3 py-2"
                >
                  <dt className="text-sm text-[#667085]">{label}</dt>
                  <dd className="text-sm font-medium text-[#17202a]">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 rounded-md border border-[#dfe4ea] bg-[#fbfcfd] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#667085]">
                API endpoint
              </p>
              <p className="mt-2 break-all text-sm text-[#17202a]">{API_URL}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
