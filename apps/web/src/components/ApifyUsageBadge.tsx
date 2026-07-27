"use client";

import { useEffect, useState } from "react";

interface UsageState {
  usageUsd: number;
  limitUsd: number;
}

export function ApifyUsageBadge({ className = "" }: { className?: string }) {
  const [usage, setUsage] = useState<UsageState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/apify-usage");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body?.configured && typeof body.usageUsd === "number") {
          setUsage({ usageUsd: body.usageUsd, limitUsd: body.limitUsd });
        }
      } catch {
        // Silently hide the badge if Apify is unreachable
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!usage) return null;

  const pct = usage.limitUsd > 0 ? usage.usageUsd / usage.limitUsd : 0;
  const colorCls = pct >= 1
    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800"
    : pct >= 0.8
    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";

  return (
    <span
      title="Uso mensual de créditos de Apify"
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${colorCls} ${className}`}
    >
      ⚡ ${usage.usageUsd.toFixed(2)} / ${usage.limitUsd.toFixed(2)}
    </span>
  );
}
