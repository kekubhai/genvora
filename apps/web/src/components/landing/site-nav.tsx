"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SIGNOZ_URL } from "@/lib/scans";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "audit", label: "Audit" },
  { id: "score", label: "Score" },
  { id: "fix", label: "Fix" },
  { id: "monitor", label: "Monitor" },
];

export function SiteNav() {
  const [lifted, setLifted] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        lifted && "border-b border-[#e4e4de]/70 bg-[#f7f7f5]/80 backdrop-blur-md",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1200px] items-center justify-between px-6 transition-all duration-500",
          lifted ? "py-2.5" : "py-4",
        )}
      >
        <Link
          href="/"
          className="group rounded-md border border-[#16181d]/15 bg-white/70 px-3 py-1.5 font-[family-name:var(--font-display)] text-lg tracking-tight backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-[#16181d]/35 hover:shadow-sm"
        >
          Genvora
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/60 px-2 py-1.5 backdrop-blur">
            <span className="px-3 text-sm font-medium text-[#52606d]">How to</span>
            <span className="h-4 w-px bg-[#16181d]/10" />
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  "relative rounded-full px-3 py-1 text-sm font-medium transition-all duration-300",
                  active === section.id
                    ? "bg-white text-[#16181d] shadow-sm"
                    : "text-[#52606d] hover:bg-white/80 hover:text-[#16181d]",
                )}
              >
                {section.label}
              </a>
            ))}
          </div>
          <a
            href={SIGNOZ_URL}
            target="_blank"
            rel="noreferrer"
            className="group rounded-full border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-[#52606d] backdrop-blur transition-all duration-300 hover:text-[#16181d]"
          >
            Traces
            <span className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              ↗
            </span>
          </a>
          <Link
            href="/sign-in"
            className="rounded-full border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-[#52606d] backdrop-blur transition-all duration-300 hover:text-[#16181d]"
          >
            Sign in
          </Link>
        </nav>

        <Link
          href="/dashboard"
          className="group rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
        >
          Run a scan
          <span className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </header>
  );
}
