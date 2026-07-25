"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AUDIT_PIPELINE,
  SIGNOZ_URL,
  buildImprovePrompt,
  getScan,
  type CategoryScoreDto,
  type RecommendationDto,
  type ScanDto,
} from "@/lib/scans";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  structure: "Structure",
  accessibility: "Accessibility",
  semantic: "Semantics",
  crawlability: "Crawlability",
  structured_data: "Structured data",
};

export default function ScanDetailPage() {
  const params = useParams<{ scanId: string }>();
  const scanId = params.scanId;
  const [scan, setScan] = useState<ScanDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const data = await getScan(scanId);
        if (cancelled) return;
        setScan(data);
        setError(null);
        if (data.status === "queued" || data.status === "running") {
          timer = setTimeout(load, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load scan");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [scanId]);

  const stageState = useMemo(() => deriveStages(scan), [scan]);
  const improvePrompt = useMemo(
    () => (scan ? buildImprovePrompt(scan) : ""),
    [scan],
  );

  if (error && !scan) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm text-[#9b2c2c]">{error}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-[var(--gv-accent)]">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  if (!scan) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--gv-muted)]">Loading scan…</p>
      </main>
    );
  }

  const critical = scan.recommendations.filter((r) => r.severity === "critical").length;
  const warnings = scan.recommendations.filter((r) => r.severity === "warning").length;
  const infos = scan.recommendations.filter((r) => r.severity === "info").length;
  const promptReady =
    scan.status === "completed" &&
    (scan.recommendations.length > 0 || scan.categoryScores.length > 0);

  return (
    <main className="min-h-screen bg-[var(--gv-bg)] text-[var(--gv-ink)]">
      <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gv-line)] pb-5">
          <div>
            <Link href="/dashboard" className="text-xs font-medium text-[var(--gv-accent)]">
              ← Workspace
            </Link>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
              {scan.site?.domain ?? `Scan ${scan.id.slice(0, 8)}`}
            </h1>
            <p className="mt-1 text-sm text-[var(--gv-muted)]">
              {scan.id.slice(0, 12)} · Status <StatusPill status={String(scan.status)} /> · started{" "}
              {new Date(scan.createdAt).toLocaleString()}
            </p>
          </div>
          <a
            href={`${SIGNOZ_URL}/traces`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--gv-line)] bg-[var(--gv-surface)] px-4 py-2 text-sm font-medium hover:border-[var(--gv-ink)]"
          >
            Open in SigNoz ↗
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <div className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--gv-muted)]">
                Overall score
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-5xl tracking-tight">
                {scan.overallScore ?? "—"}
              </p>
              {(scan.status === "queued" || scan.status === "running") && (
                <p className="mt-3 text-xs text-[var(--gv-muted)]">
                  Polling every 2s while Temporal activities run…
                </p>
              )}
            </div>

            <div className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--gv-muted)]">
                Recommendations
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--gv-muted)]">Critical</dt>
                  <dd className="font-semibold text-[#9b2c2c]">{critical}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--gv-muted)]">Warning</dt>
                  <dd className="font-semibold text-[#875a00]">{warnings}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--gv-muted)]">Info</dt>
                  <dd className="font-semibold">{infos}</dd>
                </div>
              </dl>
            </div>
          </aside>

          <div className="space-y-6">
            <ImprovePromptPanel prompt={improvePrompt} ready={promptReady} status={String(scan.status)} />

            <section className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
              <h2 className="font-[family-name:var(--font-display)] text-xl">
                Trace-aligned pipeline
              </h2>
              <p className="mt-1 text-sm text-[var(--gv-muted)]">
                Stages mirror OpenTelemetry span names exported to SigNoz.
              </p>
              <ol className="mt-5 space-y-2">
                {AUDIT_PIPELINE.map((step, index) => {
                  const state = stageState[index] ?? "pending";
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-center gap-3 border px-3 py-2.5",
                        state === "done" && "border-[var(--gv-accent)] bg-[var(--gv-tint)]",
                        state === "active" && "border-[#d4a017] bg-[#fff8e8]",
                        state === "failed" && "border-[#f0b8b8] bg-[#fff5f5]",
                        state === "pending" && "border-[var(--gv-line)] bg-[var(--gv-bg)]",
                      )}
                    >
                      <StageDot state={state} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{step.label}</p>
                        <code className="text-[10px] text-[var(--gv-muted)]">{step.span}</code>
                      </div>
                      <span className="text-xs capitalize text-[var(--gv-muted)]">{state}</span>
                    </li>
                  );
                })}
              </ol>
            </section>

            {scan.categoryScores.length > 0 ? (
              <section className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl">Category scores</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {scan.categoryScores.map((score) => (
                    <CategoryBar key={score.id} score={score} />
                  ))}
                </div>
              </section>
            ) : (
              <section className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
                <h2 className="font-[family-name:var(--font-display)] text-xl">Category scores</h2>
                <p className="mt-3 text-sm text-[var(--gv-muted)]">
                  {scan.status === "completed"
                    ? "No category breakdown was saved for this scan."
                    : scan.status === "failed"
                      ? "Scan failed before scoring finished. Start a new audit from the dashboard."
                      : "Scores appear here when the audit workflow completes."}
                </p>
              </section>
            )}

            <section className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
              <h2 className="font-[family-name:var(--font-display)] text-xl">
                How to improve
              </h2>
              <p className="mt-1 text-sm text-[var(--gv-muted)]">
                Severity-ranked findings with optional fix snippets you can paste into your site.
              </p>
              {scan.recommendations.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {scan.recommendations.map((rec) => (
                    <RecommendationRow key={rec.id} rec={rec} />
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--gv-muted)]">
                  {scan.status === "queued" || scan.status === "running"
                    ? "Recommendations will show up here after scoring + analysis finish (keep this page open — it refreshes every 2s)."
                    : scan.status === "failed"
                      ? "No report was produced. Re-run the scan; check SigNoz traces if it fails again."
                      : "No recommendations were generated for this URL."}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function ImprovePromptPanel({
  prompt,
  ready,
  status,
}: {
  prompt: string;
  ready: boolean;
  status: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopy() {
    if (!ready || !prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setCopyError(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Could not copy — select the text below and copy manually.");
    }
  }

  return (
    <section className="border border-[var(--gv-line)] bg-[var(--gv-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Fix-it prompt for your IDE / CLI
          </h2>
          <p className="mt-1 text-sm text-[var(--gv-muted)]">
            Copy this into Cursor, Claude Code, or your agent CLI. It includes the full report and
            step-by-step directions to raise the score.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!ready}
          className={cn(
            "shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition",
            ready
              ? "bg-[var(--gv-ink)] text-white hover:opacity-90"
              : "cursor-not-allowed bg-[#e8edf2] text-[var(--gv-muted)]",
          )}
        >
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </div>

      {!ready ? (
        <p className="mt-4 text-sm text-[var(--gv-muted)]">
          {status === "queued" || status === "running"
            ? "Prompt unlocks when the audit finishes and findings are ready."
            : status === "failed"
              ? "Scan failed — re-run an audit to generate a fix-it prompt."
              : "No report data yet to build a prompt."}
        </p>
      ) : (
        <>
          {copyError && (
            <p className="mt-3 text-sm text-[#9b2c2c]" role="alert">
              {copyError}
            </p>
          )}
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap break-words border border-[var(--gv-line)] bg-[var(--gv-bg)] p-4 font-mono text-[11px] leading-relaxed text-[var(--gv-ink)]">
            {prompt}
          </pre>
        </>
      )}
    </section>
  );
}

function deriveStages(scan: ScanDto | null): Array<"pending" | "active" | "done" | "failed"> {
  const total = AUDIT_PIPELINE.length;
  if (!scan) return Array.from({ length: total }, () => "pending");

  if (scan.status === "failed") {
    return AUDIT_PIPELINE.map((_, i) => (i < 2 ? "done" : i === 2 ? "failed" : "pending"));
  }

  if (scan.status === "completed") {
    return AUDIT_PIPELINE.map(() => "done");
  }

  if (scan.status === "queued") {
    return AUDIT_PIPELINE.map((_, i) => (i === 0 ? "active" : "pending"));
  }

  const started = +new Date(scan.createdAt);
  const elapsedSec = Math.max(0, (Date.now() - started) / 1000);
  const activeIndex = Math.min(total - 1, Math.floor(elapsedSec / 3));
  return AUDIT_PIPELINE.map((_, i) => {
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "pending";
  });
}

function StageDot({ state }: { state: string }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        state === "done" && "bg-[var(--gv-ok)]",
        state === "active" && "animate-pulse bg-[#d4a017]",
        state === "failed" && "bg-[#9b2c2c]",
        state === "pending" && "bg-[#c9d2dc]",
      )}
    />
  );
}

function CategoryBar({ score }: { score: CategoryScoreDto }) {
  const label = CATEGORY_LABELS[score.category] ?? score.category;
  return (
    <div className="border border-[var(--gv-line)] bg-[var(--gv-bg)] p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span>{score.score}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-[#e8edf2]">
        <div
          className="h-full bg-[var(--gv-accent)] transition-all duration-700"
          style={{ width: `${Math.max(0, Math.min(100, score.score))}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: RecommendationDto }) {
  const tone =
    rec.severity === "critical"
      ? "text-[#9b2c2c]"
      : rec.severity === "warning"
        ? "text-[#875a00]"
        : "text-[var(--gv-muted)]";

  return (
    <li className="border border-[var(--gv-line)] bg-[var(--gv-bg)] p-3">
      <div className="flex items-center gap-2">
        <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", tone)}>
          {rec.severity}
        </span>
        <p className="text-sm font-medium">{rec.title}</p>
      </div>
      <p className="mt-1 text-sm text-[var(--gv-muted)]">{rec.description}</p>
      {rec.fixSnippet && (
        <pre className="mt-2 overflow-x-auto bg-[var(--gv-ink)] p-2 text-[11px] text-[#e8edf2]">
          {rec.fixSnippet}
        </pre>
      )}
    </li>
  );
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
    <span className={cn("ml-1 inline-flex rounded px-2 py-0.5 text-xs font-semibold capitalize", tone)}>
      {status}
    </span>
  );
}
