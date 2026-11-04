"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ROWS, colOf, dateForCell } from "@/lib/grid";

type Props = {
  cells: number[];
  cols?: number;
  editable?: boolean;
  brush?: number;
  onPaint?: (index: number, value: number) => void;
  /** indices already committed by the painter */
  painted?: number[];
  /** optional second layer rendered as a dotted outline (e.g. real GitHub data) */
  overlay?: number[] | null;
  anchorDate?: string | null;
  showLabels?: boolean;
  className?: string;
  compact?: boolean;
};

export default function PixelGrid({
  cells,
  cols,
  editable = false,
  brush = 4,
  onPaint,
  painted,
  overlay,
  anchorDate,
  showLabels = false,
  className,
  compact = false,
}: Props) {
  const width = cols ?? Math.floor(cells.length / ROWS);
  const paintedSet = useMemo(() => new Set(painted ?? []), [painted]);
  const overlayArr = overlay ?? null;

  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const prevPainted = useRef<Set<number>>(new Set());

  useEffect(() => {
    const next = new Set<number>();
    for (const p of paintedSet) if (!prevPainted.current.has(p)) next.add(p);
    prevPainted.current = paintedSet;
    setFresh(next);
  }, [paintedSet]);

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const monthLabels = useMemo(() => {
    if (!showLabels || !anchorDate) return [] as { col: number; label: string }[];
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const out: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let c = 0; c < width; c++) {
      const d = dateForCell(anchorDate, c * ROWS);
      const m = d.getUTCMonth();
      if (m !== lastMonth && c > 0) {
        out.push({ col: c, label: names[m] });
        lastMonth = m;
      } else if (c === 0) {
        lastMonth = m;
      }
    }
    return out;
  }, [showLabels, anchorDate, width]);

  const paint = (i: number, erase: boolean) => {
    if (!editable || !onPaint) return;
    onPaint(i, erase ? 0 : brush);
  };

  return (
    <div className={cn("w-full select-none", className)}>
      {showLabels && (
        <div
          className="mb-1 grid font-mono text-[9px] uppercase tracking-widest text-mist-400/70"
          style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gap: compact ? 1 : 2 }}
        >
          {Array.from({ length: width }).map((_, c) => {
            const label = monthLabels.find((m) => m.col === c)?.label ?? "";
            return (
              <span key={c} className="truncate text-center">
                {label}
              </span>
            );
          })}
        </div>
      )}
      <div
        className={cn("grid", editable && "cursor-crosshair")}
        style={{
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(0, 1fr)",
          gap: compact ? 1 : 2,
          touchAction: editable ? "none" : undefined,
        }}
        onPointerLeave={() => setHover(null)}
      >
        {cells.map((value, i) => {
          const level = Math.max(0, Math.min(4, Math.round(value ?? 0)));
          const isPainted = paintedSet.has(i);
          const isFresh = fresh.has(i);
          const overlayLevel = overlayArr ? Math.max(0, Math.min(4, Math.round(overlayArr[i] ?? 0))) : null;
          const mismatch = overlayLevel !== null && overlayLevel !== level;
          return (
            <div
              key={i}
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={`cell ${i} level ${level}`}
              onPointerDown={(e) => {
                if (!editable) return;
                e.preventDefault();
                setDragging(true);
                setHover(i);
                paint(i, e.button === 2 || e.shiftKey);
              }}
              onPointerEnter={() => {
                if (!editable) return;
                setHover(i);
                if (dragging) paint(i, false);
              }}
              onContextMenu={(e) => editable && e.preventDefault()}
              onKeyDown={(e) => {
                if (!editable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  paint(i, e.shiftKey);
                }
              }}
              className={cn(
                `cell-${level} aspect-square rounded-[2px] transition-colors duration-150`,
                editable && "hover:brightness-125",
                isPainted && "ring-1 ring-inset ring-ink-950/60",
                isFresh && "animate-cellpop ring-1 ring-acid-300",
                mismatch && "outline outline-1 -outline-offset-1 outline-rust-400/70",
                hover === i && editable && "brightness-150",
              )}
            />
          );
        })}
      </div>
      {hover !== null && editable && (
        <div className="mt-2 font-mono text-[10px] text-mist-400">
          week {colOf(hover) + 1} · day {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][hover % ROWS]} ·
          index {hover}
        </div>
      )}
    </div>
  );
}
