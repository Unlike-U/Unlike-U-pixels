"use client";

import Link from "next/link";
import { PRESETS } from "@/lib/grid";
import PixelGrid from "./PixelGrid";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

export default function PresetGallery() {
  const [active, setActive] = useState(0);
  const built = useMemo(() => PRESETS.map((p) => ({ ...p, cells: p.build() })), []);
  const current = built[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {built.map((p, i) => (
          <button
            key={p.id}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            className={cn(
              "group rounded-lg border bg-ink-900/70 p-3 text-left transition-all",
              i === active
                ? "border-acid-400/60 bg-ink-850 shadow-[0_0_32px_-16px_rgba(200,247,81,0.8)]"
                : "border-ink-700 hover:border-jade-300/40",
            )}
          >
            <PixelGrid cells={p.cells} compact />
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-200">
                {p.name}
              </span>
              <span className="font-mono text-[9.5px] text-mist-400">{p.id}</span>
            </div>
          </button>
        ))}
      </div>

      <aside className="rounded-lg border border-ink-700 bg-ink-900/70 p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist-400">selected</div>
        <h3 className="mt-1 text-xl text-mist-100">{current.name}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-mist-300">{current.blurb}</p>
        <div className="mt-4">
          <PixelGrid cells={current.cells} compact />
        </div>
        <Link
          href={`/studio?preset=${current.id}`}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-acid-400 px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
        >
          load in studio →
        </Link>
      </aside>
    </div>
  );
}
