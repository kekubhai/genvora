"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { apiPath, API_URL } from "@/lib/api";

type ApiHealth = {
  status: string;
  environment?: string;
};

const scoreRows = [
  ["Structure", 82, "Ready for crawl review"],
  ["Accessibility", 74, "Needs alt text checks"],
  ["Structured data", 61, "Schema coverage pending"],
];

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(apiPath("/health"))
      .then((response) => response.json())
      .then((data: ApiHealth) => {
        if (!cancelled) {
          setHealth(data);
          setHealthError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealthError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="rounded-md border border-[#dfe4ea] bg-white px-4 py-3 text-sm text-[#667085] shadow-sm">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#16181d]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 border-r border-[#dfe4ea] bg-white px-5 py-5 lg:block">
          <div className="text-lg font-semibold tracking-tight">Genvora</div>
          <nav className="mt-8 space-y-1">
            {["Overview", "Scans", "Recommendations", "Organizations"].map((item, index) => (
              <button
                key={item}
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                  index === 0
                    ? "bg-[#e8f4f1] text-[#175b52]"
                    : "text-[#52606d] hover:bg-[#f7f8fa]"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex-1 px-5 py-5 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[#dfe4ea] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#2b7a78]">Production workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">
                AI visibility dashboard
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-[#667085]">{session.user.email}</p>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="rounded-md border border-[#c9d2dc] bg-white px-3 py-2 text-sm font-medium text-[#17202a] hover:border-[#9aa8b5]"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="grid gap-5 py-6 xl:grid-cols-[1fr_340px]">
            <section className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <StatusTile label="Backend" value={health?.status ?? "Checking"} tone={healthError ? "bad" : "good"} />
                <StatusTile label="Auth" value={session?.user ? "Session active" : "No session"} tone={session?.user ? "good" : "warn"} />
                <StatusTile label="Environment" value={health?.environment ?? "production"} tone="neutral" />
              </div>

              <div className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Domain audit queue</h2>
                    <p className="mt-1 text-sm text-[#667085]">
                      Scan workflow is ready for the backend endpoints when they are enabled.
                    </p>
                  </div>
                  <button className="h-10 rounded-md bg-[#17202a] px-4 text-sm font-semibold text-white hover:bg-[#253241]">
                    New scan
                  </button>
                </div>

                <div className="mt-5 overflow-hidden rounded-md border border-[#edf0f3]">
                  <div className="grid grid-cols-[1fr_90px_1fr] bg-[#f7f8fa] px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">
                    <span>Signal</span>
                    <span>Score</span>
                    <span>Status</span>
                  </div>
                  {scoreRows.map(([label, score, status]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[1fr_90px_1fr] border-t border-[#edf0f3] px-3 py-3 text-sm"
                    >
                      <span className="font-medium text-[#17202a]">{label}</span>
                      <span>{score}</span>
                      <span className="text-[#667085]">{status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold">Signed in as</h2>
                {session?.user ? (
                  <div className="mt-4 rounded-md bg-[#f7f8fa] p-3">
                    <p className="font-medium">{session.user.name}</p>
                    <p className="mt-1 break-all text-sm text-[#667085]">
                      {session.user.email}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#667085]">No active user session.</p>
                )}
              </div>

              <div className="rounded-lg border border-[#dfe4ea] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold">Connected services</h2>
                <dl className="mt-4 space-y-3">
                  <ConnectionRow label="API" value="Cloudflare Workers" />
                  <ConnectionRow label="Auth" value="Better Auth" />
                  <ConnectionRow label="Database" value="Supabase" />
                </dl>
                <p className="mt-4 break-all rounded-md bg-[#f7f8fa] p-3 text-xs text-[#667085]">
                  {API_URL}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass = {
    good: "bg-[#dff7ed] text-[#156447]",
    warn: "bg-[#fff4d6] text-[#875a00]",
    bad: "bg-[#fff1f1] text-[#9b2c2c]",
    neutral: "bg-[#eef2f6] text-[#475467]",
  }[tone];

  return (
    <div className="rounded-lg border border-[#dfe4ea] bg-white p-4 shadow-sm">
      <p className="text-sm text-[#667085]">{label}</p>
      <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}

function ConnectionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-[#667085]">{label}</dt>
      <dd className="text-right text-sm font-medium text-[#17202a]">{value}</dd>
    </div>
  );
}
