import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";
import { AUDIT_PIPELINE, SIGNOZ_URL } from "@/lib/scans";
import { cn } from "@/lib/utils";

const DEPARTMENTS = [
  "Crawlability",
  "Structure",
  "Semantics",
  "Accessibility",
  "Structured Data",
  "Scoring",
  "Recommendations",
  "Snapshots",
];

const CHAPTERS = [
  { n: "I", title: "How To Audit", blurb: "What AI crawlers actually see when they fetch your pages." },
  { n: "II", title: "How To Score", blurb: "The five categories that decide your AI readiness grade." },
  { n: "III", title: "How To Fix", blurb: "Turning findings into schema, headings, and llms.txt changes." },
  { n: "IV", title: "How To Monitor", blurb: "Watching every audit stage as traces in SigNoz." },
];

const STACK = ["Temporal", "OpenTelemetry", "SigNoz", "Playwright", "Supabase", "Cloudflare"];

// Word-search grid: each row hides one term related to the sites Genvora audits
const GRID = [
  { row: "QWEAISDRNEXTJSAPPBVCXZ", from: 8, to: 13 },
  { row: "ZLQKSHOPIFYSTOREMNBVCX", from: 4, to: 10 },
  { row: "TYAWORDPRESSTHEMEFBNMG", from: 3, to: 11 },
  { row: "PLWEBFLOWSITEIDETYAQZX", from: 2, to: 8 },
  { row: "KHASTROBLOGWRITERPOIUY", from: 2, to: 6 },
  { row: "JHEADLESSCMSBVCXZZLQKS", from: 1, to: 11 },
  { row: "MARKETPLACEMNBVCXLRUYA", from: 0, to: 10 },
  { row: "DDOCSSITEZCVBFTSAOSBWG", from: 1, to: 8 },
  { row: "IIALUPSAASGOGCDEEGCORA", from: 6, to: 9 },
  { row: "NXANBGLANDINGPAGEVDTIE", from: 6, to: 16 },
  { row: "YNSEXNKSQNBTXCDTPORTAL", from: 16, to: 21 },
  { row: "AGENCYSITEQWERTYUIOPAS", from: 0, to: 9 },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#16181d] font-[family-name:var(--font-sans)] selection:bg-[#c7ece2]">
      <SiteNav />
      <Hero />
      <BrandStrip />
      <Departments />
      <Guide />
      <FeatureRows />
      <ToolsSection />
      <IndustriesGrid />
      <FinalCta />
      <SiteFooter />
    </main>
  );
}

/* --------------------------------------------------------------- hero */

const HEADLINE = "Genvora lets you audit your site for AI";

function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden">
      <div
        aria-hidden
        className="gv-zoom absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/hero-pixel.jpg')", imageRendering: "pixelated" }}
      />

      <div className="relative mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 pt-24 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[44px] leading-[1.06] tracking-tight text-[#0f2620] sm:text-6xl">
            {HEADLINE.split(" ").map((word, i) => (
              <span
                key={`${word}-${i}`}
                className="gv-pop mr-[0.24em] inline-block"
                style={{ animationDelay: `${0.06 * i}s` }}
              >
                {word}
              </span>
            ))}
          </h1>
          <p
            className="gv-pop mt-6 max-w-lg text-base leading-7 text-white"
            style={{ animationDelay: "0.55s" }}
          >
           
          </p>
          <div className="gv-pop mt-8 flex flex-wrap gap-3" style={{ animationDelay: "0.7s" }}>
            <Link
              href="/dashboard"
              className="group rounded-lg bg-white px-6 py-3.5 text-sm font-semibold shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md"
            >
              Run a scan
              <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
            <a
              href={SIGNOZ_URL}
              target="_blank"
              rel="noreferrer"
              className="gv-sheen group rounded-lg bg-[#0f2620]/80 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0f2620] active:translate-y-0"
            >
              Check out the traces
              <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                ↗
              </span>
            </a>
          </div>
        </div>

        <div className="hidden flex-col items-end gap-2.5 md:flex">
          {HERO_TASKS.map((task, i) => (
            <TaskCard key={task.value} {...task} delay={0.9 + i * 0.28} />
          ))}
        </div>
      </div>
    </section>
  );
}

const HERO_TASKS = [
  { state: "done", label: "Task completed", value: "Crawlability check" },
  { state: "done", label: "Task completed", value: "Schema validated" },
  { state: "running", label: "Task running", value: "Alt text audit" },
  { state: "queued", label: "Queued", value: "Readiness score" },
] as const;

function TaskCard({
  state,
  label,
  value,
  delay,
}: {
  state: "done" | "running" | "queued";
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <div className="gv-pop" style={{ animationDelay: `${delay}s` }}>
      <div
        className="gv-float flex cursor-default items-center gap-2.5 rounded-xl border border-white/45 bg-white/25 py-2 pl-2.5 pr-4 shadow-[0_6px_22px_-8px_rgba(15,38,32,0.28)] backdrop-blur-xl transition-all duration-300 hover:-translate-x-1 hover:border-white/70 hover:bg-white/40 hover:shadow-[0_10px_28px_-8px_rgba(15,38,32,0.35)]"
        style={{ animationDelay: `${delay + 0.8}s` }}
      >
        <StateIcon state={state} />
        <span className="text-[11px] text-[#0f2620]/55">{label}</span>
        <span className="text-[11px] font-semibold text-[#0f2620]">{value}</span>
      </div>
    </div>
  );
}

function StateIcon({ state }: { state: "done" | "running" | "queued" }) {
  if (state === "running") {
    return (
      <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-[#d4a017] border-t-transparent" />
    );
  }

  if (state === "queued") {
    return <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-[#0f2620]/25" />;
  }

  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#156447] text-[8px] font-bold leading-none text-white">
      ✓
    </span>
  );
}

/* -------------------------------------------------------- brand strip */

function BrandStrip() {
  return (
    <section className="border-b border-[#e4e4de] bg-[#f7f7f5] py-12">
      <Reveal className="mx-auto max-w-[1200px] px-6">
        <p className="text-center text-sm text-[#667085]">
          every audit stage is instrumented and traced end to end
        </p>
      </Reveal>

      <div className="gv-marquee-wrap relative mt-8 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="gv-marquee flex w-max items-center gap-14">
          {[...STACK, ...STACK, ...STACK, ...STACK].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="cursor-default font-[family-name:var(--font-display)] text-xl tracking-tight text-[#98a2ae] transition-colors duration-300 hover:text-[#2b7a78]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- departments */

function Departments() {
  return (
    <section id="audit" className="scroll-mt-24 border-b border-[#e4e4de] py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal>
          <h2 className="max-w-3xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-[40px]">
            Genvora is an audit orchestration platform
            <span className="text-[#98a2ae]"> designed to make your whole site legible to AI</span>
          </h2>
        </Reveal>

        <Reveal from="scale" delay={0.1}>
          <div className="group mt-14 overflow-hidden rounded-2xl border border-[#e4e4de] bg-white shadow-sm transition-shadow duration-500 hover:shadow-lg">
            <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-3">
              <div className="flex items-center gap-3 text-xs text-[#98a2ae]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f1f3f5] transition-colors duration-500 group-hover:bg-[#ffd9d9]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#f1f3f5] transition-colors delay-75 duration-500 group-hover:bg-[#ffeeba]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#f1f3f5] transition-colors delay-150 duration-500 group-hover:bg-[#c7ece2]" />
                <span className="ml-2">genvora / audit-workspace</span>
              </div>
              <span className="rounded bg-[#e8f4f1] px-2 py-0.5 text-[11px] font-semibold text-[#175b52]">
                Score 82%
              </span>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[200px_1fr]">
              <div className="space-y-1 text-sm">
                {["Overview", "Genvora", "Scans", "Library"].map((item, i) => (
                  <div
                    key={item}
                    className={cn(
                      "cursor-default rounded-md px-3 py-2 transition-all duration-300",
                      i === 1
                        ? "bg-[#e8f4f1] font-medium text-[#175b52]"
                        : "text-[#667085] hover:bg-[#f7f7f5] hover:pl-4 hover:text-[#16181d]",
                    )}
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DEPARTMENTS.map((dept, i) => (
                  <div
                    key={dept}
                    className="gv-stagger cursor-default rounded-xl border border-[#edf0f3] bg-[#fbfbfa] px-4 py-6 text-center text-sm font-medium text-[#3f4b57] transition-all duration-300 hover:-translate-y-1 hover:border-[#c7ece2] hover:bg-white hover:text-[#175b52] hover:shadow-md"
                    style={{ transitionDelay: `${0.06 * i}s` }}
                  >
                    {dept}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#edf0f3] px-6 py-4">
              <div className="flex items-center rounded-lg border border-[#e4e4de] bg-[#fbfbfa] px-4 py-3 text-sm text-[#98a2ae] transition-colors duration-300 focus-within:border-[#c7ece2] hover:border-[#c9d2dc]">
                Ask genvora to spin up new audit agents
                <span className="gv-caret ml-0.5 font-semibold text-[#2b7a78]">|</span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-14 grid gap-8 md:grid-cols-3" delay={0.05}>
          <ValueProp
            index={0}
            title="Agentic departments"
            body="Genvora is designed like a real audit team, with specialised stages, a workflow manager, and shared page context."
          />
          <ValueProp
            index={1}
            title="Human in the loop"
            body="Agents work alongside you, surfacing recommendations for review before you ship changes to production."
          />
          <ValueProp
            index={2}
            title="Fully extensible"
            body="Add custom activities, LLM providers, or your own scoring rules — every new stage emits spans automatically."
          />
        </Reveal>
      </div>
    </section>
  );
}

function ValueProp({ title, body, index }: { title: string; body: string; index: number }) {
  return (
    <div className="gv-stagger group" style={{ transitionDelay: `${0.12 * index}s` }}>
      <span className="block h-px w-8 bg-[#c9d2dc] transition-all duration-500 group-hover:w-16 group-hover:bg-[#2b7a78]" />
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#667085]">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------- guide */

function Guide() {
  return (
    <section id="score" className="scroll-mt-24 border-b border-[#e4e4de] bg-white py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-[40px]">
              Learn how to rank in AI answers
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#667085]">
              Read the guide, then let Genvora turn each step into a roadmap, tasks, and agents.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="group rounded-lg border border-[#c9d2dc] px-5 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-[#16181d] hover:shadow-sm active:translate-y-0"
          >
            Put the guide to work
            <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </Reveal>

        <Reveal className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CHAPTERS.map((chapter, i) => (
            <article
              key={chapter.n}
              className="gv-stagger group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#e4e4de] bg-[#f7f7f5] p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#c7ece2] hover:bg-white hover:shadow-lg"
              style={{ transitionDelay: `${0.1 * i}s` }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2ae] transition-colors duration-300 group-hover:text-[#2b7a78]">
                  Chapter {chapter.n}
                </p>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight">
                  {chapter.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#667085]">{chapter.blurb}</p>
              </div>
              <p className="mt-8 flex items-center gap-1.5 text-sm font-medium text-[#16181d]">
                <span className="bg-gradient-to-r from-[#16181d] to-[#16181d] bg-[length:0%_1px] bg-left-bottom bg-no-repeat transition-all duration-500 group-hover:bg-[length:100%_1px]">
                  Read this chapter ({chapter.n})
                </span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- feature rows */

function FeatureRows() {
  return (
    <section id="fix" className="scroll-mt-24 border-b border-[#e4e4de] py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-[40px]">
            Audit a real site with the help of specialized agents
          </h2>
          <Link
            href="/dashboard"
            className="gv-sheen group rounded-lg bg-[#17202a] px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253241] hover:shadow-lg active:translate-y-0"
          >
            Start your roadmap
            <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </Reveal>

        <div className="mt-16 space-y-24">
          <FeatureRow
            title="A full roadmap tailored to your domain"
            body="When auditing a site, it's hard to know what matters next. Genvora walks you through every stage of AI readiness, and kicks off agents for each milestone as you go."
            learn="How to audit"
            visual={<RoadmapVisual />}
          />
          <FeatureRow
            title="Fetch pages and analyse markup with agents"
            body="Crawl, render, and parse your pages with Playwright-backed agents. Once a scan is live, analysis agents work through structure, semantics, and schema on their own."
            learn="How to fix"
            visual={<AgentChatVisual />}
            flip
          />
          <FeatureRow
            title="Observe every step with traces and spans"
            body="Each activity emits an OpenTelemetry span with rich attributes — bot user agent, load time, score, token cost — streamed into your own SigNoz instance."
            learn="How to monitor"
            visual={<TraceVisual />}
          />
          <FeatureRow
            title="Scale with scores, recommendations, and snapshots"
            body="Genvora tracks readiness over time, ranks fixes by severity, and stores an HTML and screenshot snapshot of every scan so you can prove what changed."
            learn="How to score"
            visual={<AnalyticsVisual />}
            flip
          />
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  title,
  body,
  learn,
  visual,
  flip,
}: {
  title: string;
  body: string;
  learn: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,360px)_1fr]">
      <Reveal from={flip ? "right" : "left"} className={cn(flip && "lg:order-2")}>
        <div className="group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f4f1] transition-all duration-500 group-hover:rotate-45 group-hover:bg-[#c7ece2]">
            <span className="h-4 w-4 rounded-sm bg-[#2b7a78] transition-transform duration-500 group-hover:rotate-45" />
          </div>
          <h3 className="mt-6 font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight">
            {title}
          </h3>
          <p className="mt-4 text-sm leading-7 text-[#667085]">{body}</p>
          <div className="mt-7 space-y-2 text-sm">
            <p className="text-[#98a2ae]">
              Learn <span className="font-medium text-[#16181d]">{learn}</span>
            </p>
            <Link
              href="/dashboard"
              className="group/link flex w-fit items-center gap-1.5 font-medium text-[#667085] transition-colors duration-300 hover:text-[#16181d]"
            >
              Run this in Genvora
              <span className="inline-block transition-transform duration-300 group-hover/link:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </Reveal>
      <Reveal
        from={flip ? "left" : "right"}
        delay={0.1}
        className={cn("min-w-0", flip && "lg:order-1")}
      >
        {visual}
      </Reveal>
    </div>
  );
}

/* ----------------------------------------------------------- visuals */

function RoadmapVisual() {
  const stages = [
    { label: "Fetch stage", count: "1/1", items: AUDIT_PIPELINE.slice(0, 2) },
    { label: "Analysis stage", count: "0/4", items: AUDIT_PIPELINE.slice(2, 6) },
    { label: "Report stage", count: "0/4", items: AUDIT_PIPELINE.slice(6, 10) },
  ];

  return (
    <div className="grid gap-1 overflow-hidden rounded-2xl border border-[#e4e4de] bg-[#fbfbfa] sm:grid-cols-3">
      {stages.map((stage, index) => (
        <div
          key={stage.label}
          className={cn(
            "min-h-[380px] p-4 transition-colors duration-500 hover:bg-white",
            index < stages.length - 1 && "sm:border-r sm:border-[#edf0f3]",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[#98a2ae]">
            <span>{stage.label}</span>
            <span>{stage.count}</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {stage.items.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  "gv-stagger cursor-grab rounded-xl border bg-white px-3 py-2.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:rotate-1 hover:shadow-md",
                  index === 0 && i === 0
                    ? "border-[#c7ece2]"
                    : "border-[#edf0f3] opacity-60 hover:opacity-100",
                )}
                style={{ transitionDelay: `${0.05 * (index * 4 + i)}s` }}
              >
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="mt-1 text-[10px] text-[#98a2ae]">
                  {index === 0 ? "User task" : "Agent task"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentChatVisual() {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-[#e4e4de] bg-white p-5 shadow-sm transition-shadow duration-500 hover:shadow-md">
        <span className="rounded-md bg-[#f1f3f5] px-2 py-1 text-[11px] font-medium text-[#667085]">
          Structured data
        </span>
        <div className="mt-4 space-y-3">
          <span className="gv-grow-x block h-3 rounded bg-[#f1f3f5]" style={cssW("66%")} />
          <span
            className="gv-grow-x block h-3 rounded bg-[#f1f3f5]"
            style={cssW("48%", "0.15s")}
          />
          <div className="h-40 rounded-lg bg-[#f7f7f5]" />
        </div>
        <p className="mt-4 text-xs text-[#98a2ae]">Schema Audit Updates</p>
      </div>

      <div className="mt-[-80px] ml-auto w-full max-w-[420px] rounded-2xl border border-[#e4e4de] bg-white shadow-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl">
        <div className="border-b border-[#edf0f3] px-4 py-3 text-xs text-[#667085]">
          Engineer<span className="text-[#c9d2dc]"> / </span>
          <span className="font-medium text-[#16181d]">Schema Audit Updates</span>
        </div>
        <div className="space-y-4 p-4">
          <p className="gv-stagger ml-auto w-fit rounded-xl bg-[#eef2f6] px-3 py-2 text-xs text-[#3f4b57]">
            Check whether JSON-LD is valid on this domain
          </p>
          <p className="gv-stagger text-xs leading-6 text-[#3f4b57]" style={{ transitionDelay: "0.15s" }}>
            Let me fetch the rendered HTML to investigate this schema issue.
          </p>
          <p className="gv-stagger text-xs leading-6 text-[#667085]" style={{ transitionDelay: "0.3s" }}>
            It looks like the product pages ship JSON-LD without a{" "}
            <code className="text-[#16181d]">name</code> field. Could you confirm the canonical
            product title so I can generate the corrected snippet?
          </p>
          <div
            className="gv-stagger space-y-2 rounded-lg bg-[#f7f7f5] p-3"
            style={{ transitionDelay: "0.45s" }}
          >
            {["Planning Subagent", "Schema Subagent"].map((agent, i) => (
              <div key={agent} className="group">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2ae]">
                  Delegating to Subagent
                </p>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="font-medium transition-colors duration-300 group-hover:text-[#2b7a78]">
                    {agent}
                  </span>
                  <span className="flex items-center gap-1 text-[#98a2ae]">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="gv-dot h-1 w-1 rounded-full bg-[#2b7a78]"
                        style={{ animationDelay: `${d * 0.18 + i * 0.4}s` }}
                      />
                    ))}
                    2m 48s
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[#edf0f3] p-3">
          <div className="group flex items-center justify-between rounded-lg border border-[#e4e4de] px-3 py-2 text-[11px] text-[#98a2ae] transition-colors duration-300 hover:border-[#c9d2dc]">
            Ask genvora to spin up new audit agents...
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#17202a] text-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
              ↑
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceVisual() {
  const spans = AUDIT_PIPELINE.slice(0, 8);
  const widths = [46, 18, 14, 12, 11, 13, 8, 16];

  return (
    <div className="rounded-2xl border border-[#e4e4de] bg-white p-6 shadow-sm transition-shadow duration-500 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">audit.workflow</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#98a2ae]">
            genvora-worker
          </p>
        </div>
        <p className="text-sm font-medium text-[#175b52]">4,312 ms</p>
      </div>

      <div className="mt-6 space-y-2.5">
        {spans.map((span, i) => (
          <div key={span.id} className="group flex cursor-default items-center gap-3">
            <span className="w-[150px] shrink-0 truncate text-[11px] text-[#667085] transition-colors duration-300 group-hover:text-[#16181d]">
              {span.span}
            </span>
            <span className="relative h-2.5 flex-1 rounded bg-[#f1f3f5]">
              <span
                className="gv-grow-x absolute inset-y-0 rounded bg-[#2b7a78] transition-[width,background-color] duration-1000 group-hover:bg-[#175b52]"
                style={{
                  left: `${i * 6}%`,
                  ...cssW(`${widths[i] ?? 12}%`, `${i * 0.09}s`),
                }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-[10px] text-[#c9d2dc] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              {(widths[i] ?? 12) * 43} ms
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#edf0f3] pt-4 text-[11px] text-[#98a2ae]">
        <span className="rounded bg-[#f7f7f5] px-2 py-1 transition-colors duration-300 hover:bg-[#e8f4f1] hover:text-[#175b52]">
          audit.user_agent = GPTBot
        </span>
        <span className="rounded bg-[#f7f7f5] px-2 py-1 transition-colors duration-300 hover:bg-[#e8f4f1] hover:text-[#175b52]">
          score.overall = 82
        </span>
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [42, 55, 48, 63, 58, 71, 66, 78, 74, 82, 79, 88];

  return (
    <div className="rounded-2xl border border-[#e4e4de] bg-white p-6 shadow-sm transition-shadow duration-500 hover:shadow-md">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Scans", "211", "+34%"],
          ["Avg score", "78", "+8%"],
          ["Critical fixes", "12", "-37%"],
        ].map(([label, value, delta], i) => (
          <div
            key={label}
            className="gv-stagger cursor-default rounded-xl bg-[#f7f7f5] p-4 transition-all duration-300 hover:-translate-y-1 hover:bg-[#e8f4f1]"
            style={{ transitionDelay: `${0.1 * i}s` }}
          >
            <p className="text-xs text-[#667085]">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tracking-tight">
              {value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#175b52]">{delta}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex h-40 items-end gap-2">
        {bars.map((height, i) => (
          <span key={i} className="group flex h-full flex-1 items-end">
            <span
              className="gv-grow-y w-full cursor-default rounded-t bg-[#c7ece2] transition-[height,background-color] duration-700 group-hover:bg-[#2b7a78]"
              style={{
                ["--gv-h" as string]: `${height}%`,
                transitionDelay: `${0.05 * i}s`,
              }}
            />
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#98a2ae]">Readiness score, last 12 scans</p>
    </div>
  );
}

function cssW(width: string, delay?: string): React.CSSProperties {
  return {
    ["--gv-w" as string]: width,
    ...(delay ? { transitionDelay: delay } : {}),
  };
}

/* -------------------------------------------------------------- tools */

function ToolsSection() {
  return (
    <section id="monitor" className="scroll-mt-24 border-b border-[#e4e4de] bg-white py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal>
          <h2 className="max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-[40px]">
            All the tools and systems your audits need
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#667085]">
            Give agents the context, crawlers, and approvals they need to keep audit work moving.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,340px)_1fr]">
          <Reveal from="left">
            <ul className="space-y-5 text-sm leading-6">
              {[
                "You stay in control — no fix ships without your approval",
                "Run multiple scans in the background at the same time",
                "Customise agents with providers, rules, and schedules",
              ].map((item, i) => (
                <li
                  key={item}
                  className="gv-stagger group flex cursor-default gap-3"
                  style={{ transitionDelay: `${0.12 * i}s` }}
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2b7a78] transition-transform duration-300 group-hover:scale-[1.8]" />
                  <span className="text-[#3f4b57] transition-colors duration-300 group-hover:text-[#16181d]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal from="right" delay={0.1}>
            <div className="rounded-2xl border border-[#e4e4de] bg-[#fbfbfa] p-5">
              <div className="flex flex-wrap gap-2">
                {["Fetch pages", "Parse markup", "Validate schema", "Score readiness"].map(
                  (tab, i) => (
                    <span
                      key={tab}
                      className={cn(
                        "gv-stagger cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
                        i === 0
                          ? "bg-[#17202a] text-white"
                          : "bg-white text-[#667085] hover:-translate-y-0.5 hover:text-[#16181d] hover:shadow-sm",
                      )}
                      style={{ transitionDelay: `${0.07 * i}s` }}
                    >
                      {tab}
                    </span>
                  ),
                )}
              </div>

              <div className="group mt-5 rounded-xl border border-[#e4e4de] bg-white p-5 transition-all duration-500 hover:border-[#c7ece2] hover:shadow-md">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2ae]">
                  Recommendation preview
                </p>
                <p className="mt-4 text-sm font-semibold">Add llms.txt to the site root</p>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  No <code className="text-[#16181d]">llms.txt</code> was found. Publishing one lets
                  assistants discover which sections of the site are safe to summarise, and which
                  canonical URLs to cite.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-lg bg-[#17202a] p-3 text-[11px] leading-5 text-[#e8edf2] transition-transform duration-500 group-hover:-translate-y-0.5">
{`# Genvora
> AI readiness audits

## Docs
- /docs/getting-started
- /docs/scoring`}
                </pre>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-md bg-[#fff1f1] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9b2c2c] transition-transform duration-300 group-hover:scale-105">
                    Critical
                  </span>
                  <span className="rounded-md bg-[#e8f4f1] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#175b52]">
                    Awaiting approval
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- industries */

function IndustriesGrid() {
  return (
    <section className="border-b border-[#e4e4de] py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-center">
          <Reveal from="left">
            <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-[40px]">
              Audit across stacks
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#667085]">
              From marketing sites and docs portals to storefronts and single-page apps, Genvora
              turns any domain into a scored, traceable audit.
            </p>
          </Reveal>

          <Reveal from="right" delay={0.1} className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1.5">
              {GRID.map(({ row, from, to }, rowIndex) => (
                <div key={row} className="flex gap-1.5">
                  {row.split("").map((char, i) => {
                    const hit = i >= from && i <= to;
                    return (
                      <span
                        key={`${row}-${i}`}
                        className={cn(
                          "gv-stagger flex h-7 w-7 cursor-default items-center justify-center rounded text-[11px] font-semibold duration-300 hover:scale-125",
                          hit
                            ? "bg-[#17202a] text-white hover:bg-[#2b7a78]"
                            : "bg-[#f1f3f5] text-[#c9d2dc] hover:bg-[#e4e4de] hover:text-[#667085]",
                        )}
                        style={{ transitionDelay: `${rowIndex * 0.05 + i * 0.012}s` }}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- final cta */

function FinalCta() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal from="scale">
          <div className="overflow-hidden rounded-3xl border border-[#e4e4de] bg-white transition-shadow duration-500 hover:shadow-lg">
            <div className="grid gap-10 p-10 lg:grid-cols-2 lg:items-center lg:p-14">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-[40px]">
                  Audit an entire site with AI agents
                </h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-[#667085]">
                  Genvora is an audit orchestration platform designed to make your site readable,
                  citable, and observable.
                </p>
                <Link
                  href="/dashboard"
                  className="gv-sheen group mt-8 inline-block rounded-lg bg-[#17202a] px-6 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253241] hover:shadow-lg active:translate-y-0"
                >
                  Run a scan
                  <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>

              <div className="rounded-2xl border border-[#e4e4de] bg-[#fbfbfa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#98a2ae]">
                  Genvora product preview
                </p>
                <div className="mt-4 space-y-2.5">
                  {AUDIT_PIPELINE.slice(0, 5).map((step, i) => (
                    <div
                      key={step.id}
                      className="gv-stagger flex cursor-default items-center justify-between rounded-lg border border-[#edf0f3] bg-white px-3 py-2.5 transition-all duration-300 hover:translate-x-1 hover:border-[#c7ece2]"
                      style={{ transitionDelay: `${0.1 * i}s` }}
                    >
                      <span className="text-xs font-medium">{step.label}</span>
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          i < 3 ? "bg-[#156447]" : "bg-[#e4e4de]",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- footer */

function SiteFooter() {
  return (
    <footer className="border-t border-[#e4e4de] bg-white py-16">
      <div className="mx-auto max-w-[1200px] px-6">
        <Reveal className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn title="How to">
            {["audit", "score", "fix", "monitor"].map((item) => (
              <FooterLink key={item} href={`#${item}`}>
                How to {item}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Product">
            <FooterLink href="/dashboard">Dashboard</FooterLink>
            <FooterLink href={SIGNOZ_URL} external>
              SigNoz traces
            </FooterLink>
            <FooterLink href="/sign-up">Create account</FooterLink>
          </FooterColumn>

          <FooterColumn title="Built with">
            {STACK.slice(0, 4).map((item) => (
              <li key={item} className="text-sm text-[#667085]">
                {item}
              </li>
            ))}
          </FooterColumn>

          <div className="gv-stagger" style={{ transitionDelay: "0.3s" }}>
            <p className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
              Genvora
            </p>
            <p className="mt-3 text-sm leading-6 text-[#667085]">
              An audit orchestration platform for the agentic web.
            </p>
            <Link
              href="/dashboard"
              className="gv-sheen group mt-5 inline-block rounded-lg bg-[#17202a] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#253241] hover:shadow-lg active:translate-y-0"
            >
              Run a scan
              <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </Reveal>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[#edf0f3] pt-6 text-xs text-[#98a2ae]">
          <p>Copyright © 2026 Genvora</p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms of Service", "Docs"].map((item) => (
              <span
                key={item}
                className="cursor-pointer transition-colors duration-300 hover:text-[#16181d]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#98a2ae]">{title}</p>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "group inline-flex items-center gap-1 text-sm text-[#667085] transition-all duration-300 hover:translate-x-1 hover:text-[#16181d]";

  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">↗</span>
        </a>
      ) : (
        <Link href={href} className={className}>
          {children}
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">→</span>
        </Link>
      )}
    </li>
  );
}
