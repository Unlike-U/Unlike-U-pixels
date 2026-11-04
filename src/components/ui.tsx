"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  title,
  step,
  subtitle,
  right,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  step?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-ink-600/80 bg-ink-900/80 backdrop-blur-sm",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_24px_48px_-32px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 border-b border-ink-700/80 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-mist-300">
              {step && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-acid-400 text-[10px] font-bold text-ink-950">
                  {step}
                </span>
              )}
              {title}
            </h2>
            {subtitle && <p className="mt-1.5 text-[13px] leading-snug text-mist-400">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "acid" | "outline" | "ghost" | "danger" | "jade";
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({
  variant = "outline",
  size = "md",
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-mono uppercase tracking-[0.14em]",
        "transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acid-400",
        size === "sm" ? "px-2.5 py-1.5 text-[10px]" : "px-3.5 py-2 text-[11px]",
        variant === "acid" &&
          "bg-acid-400 text-ink-950 hover:bg-acid-300 active:translate-y-px shadow-[0_0_24px_-8px_rgba(200,247,81,0.7)]",
        variant === "jade" && "bg-jade-500 text-ink-950 hover:bg-jade-400 active:translate-y-px",
        variant === "outline" &&
          "border border-ink-500 bg-ink-850 text-mist-200 hover:border-jade-300/60 hover:text-mist-100 active:translate-y-px",
        variant === "ghost" && "text-mist-300 hover:bg-ink-800 hover:text-mist-100",
        variant === "danger" &&
          "border border-rust-400/40 bg-rust-400/10 text-rust-400 hover:bg-rust-400/20 active:translate-y-px",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-snug text-mist-400/80">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[12px] text-mist-100",
        "placeholder:text-mist-400/50 focus:border-jade-300/70 focus:outline-none",
        className,
      )}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full appearance-none rounded-md border border-ink-600 bg-ink-950/70 px-3 py-2 font-mono text-[12px] text-mist-100",
        "focus:border-jade-300/70 focus:outline-none",
        className,
      )}
    >
      {children}
    </select>
  );
}

const STATUS_STYLE: Record<string, string> = {
  idle: "border-ink-500 text-mist-300",
  running: "border-acid-400/50 bg-acid-400/10 text-acid-300",
  paused: "border-rust-400/40 bg-rust-400/10 text-rust-400",
  done: "border-jade-400/50 bg-jade-400/10 text-jade-300",
  error: "border-red-400/50 bg-red-400/10 text-red-300",
  cancelled: "border-ink-500 text-mist-400",
};

export function StatusPill({ status, pulse }: { status: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
        STATUS_STYLE[status] ?? STATUS_STYLE.idle,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulse && status === "running" && "animate-blink",
        )}
      />
      {status}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-850/60 px-3 py-2">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-mist-400">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-lg leading-none tabular-nums",
          accent ? "text-acid-400" : "text-mist-100",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[10.5px] text-mist-400">{sub}</div>}
    </div>
  );
}

export function Meter({ percent, tone = "acid" }: { percent: number; tone?: "acid" | "jade" }) {
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          tone === "acid" ? "bg-acid-400" : "bg-jade-400",
        )}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
