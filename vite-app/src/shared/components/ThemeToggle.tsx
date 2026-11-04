"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type Theme = "dark" | "light";

export const THEME_KEY = "ppx.theme";

/**
 * Runs before first paint (inlined in <head>) so the page never flashes the
 * wrong theme. Saved choice wins; otherwise follow the OS preference.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}if(t==='light'){document.documentElement.classList.add('light')}}catch(e){}})();`;

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}

/* pixel-art icons, 8×8, drawn with crisp rects */
function PixelIcon({ map, size = 14 }: { map: string[]; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${map[0].length} ${map.length}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {map.flatMap((row, y) =>
        row.split("").map((ch, x) =>
          ch === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null,
        ),
      )}
    </svg>
  );
}

const SUN = [
  "#..#..#.",
  ".#....#.",
  "...##...",
  "#.####.#",
  "..####..",
  "...##...",
  ".#....#.",
  "#..#..#.",
];

const MOON = [
  "..###...",
  ".##.....",
  "##......",
  "##......",
  "##......",
  "##.....#",
  ".##...##",
  "..####..",
];

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);

    // follow OS changes until the user makes an explicit choice
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) return;
      const next: Theme = e.matches ? "light" : "dark";
      document.documentElement.classList.toggle("light", next === "light");
      setTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  const isLight = mounted && theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "group relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-full border border-ink-600 bg-ink-850 p-[3px]",
        "transition-colors hover:border-acid-400/60",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid-400",
        className,
      )}
    >
      {/* track icons */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-[9px] text-mist-400">
        <PixelIcon map={MOON} size={11} />
        <PixelIcon map={SUN} size={11} />
      </span>
      {/* knob */}
      <span
        className={cn(
          "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-acid-400 text-ink-950",
          "shadow-[0_0_14px_-3px_var(--color-acid-400)] transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]",
          isLight ? "translate-x-[28px]" : "translate-x-0",
        )}
      >
        <PixelIcon map={isLight ? SUN : MOON} size={12} />
      </span>
    </button>
  );
}
