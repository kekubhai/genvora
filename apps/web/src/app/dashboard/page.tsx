"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";
import { API_URL } from "@/lib/api";
import {
  AUDIT_PIPELINE,
  SIGNOZ_URL,
  createScan,
  listSites,
  normalizeScanUrl,
  upsertSite,
  type SiteSummary,
} from "@/lib/scans";
import { cn } from "@/lib/utils";

type ApiHealth = { status: string; environment?: string };

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState("https://example.com");
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<ApiHealth | null>(null);

  const refreshSites = useCallback(async () => {
    try {
      const data = await listSites();
      setSites(data);
      setError(null);
    } catch (err) {
      setSites([]);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load sites — check API CORS / network",
      );
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    void refreshSites();
    fetch(`${API_URL}/health`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`health ${r.status}`);
        return r.json() as Promise<ApiHealth>;
      })
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));
  }, [refreshSites]);

  async function handleStartScan(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const target = normalizeScanUrl(url);
      const site = await upsertSite(target);
      const scan = await createScan(site.id, target);
      router.push(`/dashboard/scans/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start scan");
      setStarting(false);
    }
  }

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => router.push("/sign-in"),
      },
    });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--gv-bg)]">
        <p className="text-sm text-[var(--gv-muted)]">Loading workspace…</p>
      </div>
    );
  }

  const recentScans = sites
    .flatMap((site) =>
      (site.scans ?? []).map((scan) => ({
        ...scan,
        domain: site.domain,
        siteId: site.id,
      })),
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 8);

  return (
    <main className="min-h-screen bg-[var(--gv-bg)] text-[var(--gv-ink)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-60 shrink-0 border-r border-[var(--gv-line)] bg-[var(--gv-surface)] px-5 py-6 lg:block">
          <Link href="/" className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            Genvora
          </Link>
          <nav className="mt-10 space-y-1 text-sm font-black">
            <NavItem   href="/dashboard" active>
              Overview
            </NavItem>
            <NavItem href="/dashboard#pipeline">Pipeline</NavItem>
            <a
              href={SIGNOZ_URL}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-3 py-2 text-[var(--gv-muted)] hover:bg-[var(--gv-bg)] hover:text-[var(--gv-ink)]"
            >
              SigNoz traces ↗
            </a>
          </nav>
          <p className="mt-12 text-xs leading-5 text-[var(--gv-muted)]">
            Each scan emits nested OpenTelemetry spans into SigNoz — latency,
            scores, and bot UA attributes included.
          </p>
        </aside>

        <section className="flex-1 px-5 py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b border-[var(--gv-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gv-accent)]">
                AI readiness workspace
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
                Run an audit. Watch the agent pipeline.
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {session?.user && (
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-[var(--gv-muted)]">{session.user.email}</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-[var(--gv-line)] bg-[var(--gv-surface)] px-3 py-2 text-sm font-medium hover:border-[var(--gv-ink)]"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="API" value={health?.status ?? "offline"} ok={health?.status === "ok"} />
            <Stat label="Sites tracked" value={String(sites.length)} ok />
            <Stat
              label="SigNoz"
              value={SIGNOZ_URL.replace(/^https?:\/\//, "")}
              ok
              href={SIGNOZ_URL}
            />
          </div>

          <form
            onSubmit={handleStartScan}
            className="mt-6 border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="block flex-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--gv-muted)]">
                  Target URL
                </span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://yoursite.com"
                  className="mt-2 h-12 w-full border border-[var(--gv-line)] bg-[var(--gv-bg)] px-3 text-sm outline-none focus:border-[var(--gv-accent)]"
                />
              </label>
              <button
                type="submit"
                disabled={starting}
                className={cn(
                  "h-12 shrink-0 bg-[var(--gv-ink)] px-6 text-sm font-semibold text-white",
                  starting && "opacity-60",
                )}
              >
                {starting ? "Starting…" : "Start audit scan"}
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-[#9b2c2c]">
                {error}
              </p>
            )}
            <p className="mt-3 text-xs text-[var(--gv-muted)]">
              Triggers Temporal <code className="text-[var(--gv-ink)]">AuditWorkflow</code> —
              9 analysis activities + LLM summary, all traced as{" "}
              <code className="text-[var(--gv-ink)]">activity.*</code> spans.
            </p>
          </form>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-[family-name:var(--font-display)] text-xl">Recent scans</h2>
                <button
                  type="button"
                  onClick={() => {
                    setLoadingSites(true);
                    void refreshSites();
                  }}
                  className="text-xs font-medium text-[var(--gv-accent)]"
                >
                  Refresh
                </button>
              </div>

              <div className="border border-[var(--gv-line)] bg-[var(--gv-surface)]">
                <div className="grid grid-cols-[1.2fr_0.7fr_0.5fr_0.6fr] gap-2 border-b border-[var(--gv-line)] bg-[var(--gv-bg)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gv-muted)]">
                  <span>Domain</span>
                  <span>Status</span>
                  <span>Score</span>
                  <span>Opened</span>
                </div>
                {loadingSites ? (
                  <p className="px-4 py-6 text-sm text-[var(--gv-muted)]">Loading…</p>
                ) : recentScans.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-[var(--gv-muted)]">
                    No scans yet. Start one above to populate SigNoz.
                  </p>
                ) : (
                  recentScans.map((scan) => (
                    <Link
                      key={scan.id}
                      href={`/dashboard/scans/${scan.id}`}
                      className="grid grid-cols-[1.2fr_0.7fr_0.5fr_0.6fr] gap-2 border-t border-[var(--gv-line)] px-4 py-3 text-sm transition hover:bg-[var(--gv-bg)]"
                    >
                      <span className="truncate font-medium">{scan.domain}</span>
                      <StatusPill status={scan.status} />
                      <span>{scan.overallScore ?? "—"}</span>
                      <span className="text-[var(--gv-muted)]">
                        {new Date(scan.createdAt).toLocaleString()}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </section>

            <section id="pipeline">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl">
                Instrumented pipeline
              </h2>
              <ol className="border border-[var(--gv-line)] bg-[var(--gv-surface)]">
                {AUDIT_PIPELINE.map((step, index) => (
                  <li
                    key={step.id}
                    className="flex items-start gap-3 border-t border-[var(--gv-line)] px-4 py-3 first:border-t-0"
                  >
                    <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold text-[var(--gv-accent)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{step.label}</p>
                      <p className="text-xs text-[var(--gv-muted)]">{step.detail}</p>
                      <code className="mt-1 block truncate text-[10px] text-[var(--gv-accent)]">
                        {step.span}
                      </code>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-3 py-2",
        active
          ? "bg-[var(--gv-tint)] font-medium text-black"
          : "text-black hover:bg-[var(--gv-bg)] hover:text-[var(--gv-ink)]",
      )}
    >
      {children}
    </Link>
  );
}

function Stat({
  label,
  value,
  ok,
  href,
}: {
  label: string;
  value: string;
  ok?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--gv-muted)]">{label}</p>
      <p className={cn("mt-2 text-sm font-semibold", ok ? "text-[var(--gv-ok)]" : "text-[var(--gv-ink)]")}>
        {value}
      </p>
    </>
  );
  const className = "border border-[var(--gv-line)] bg-[var(--gv-surface)] p-4";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={`${className} block hover:border-[var(--gv-accent)]`}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "completed"
      ? "bg-[var(--gv-tint)] text-[var(--gv-ok)]"
      : status === "failed"
        ? "bg-[#fff1f1] text-[#9b2c2c]"
        : status === "running"
          ? "bg-[#fff4d6] text-[#875a00]"
          : "bg-[var(--gv-bg)] text-[var(--gv-muted)]";

  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-semibold capitalize", tone)}>
      {status}
    </span>
  );
}
