"use client";

import { useMemo, useRef, useState } from "react";
import PixelGrid from "@/components/PixelGrid";
import { Button, Panel, Stat, TextInput, Select } from "@/components/ui";
import {
  IconBrush,
  IconDownload,
  IconGitHub,
  IconGrid,
  IconImage,
  IconSave,
  IconSpinner,
  IconType,
  IconWand,
} from "@/components/Icons";
import {
  COLS,
  PRESETS,
  ROWS,
  clampLevel,
  commitsForLevel,
  emptyCells,
  mirrorCells,
  setCell,
  shiftColumns,
  summarize,
  textToCells,
  maxTextLength,
} from "@/lib/grid";
import { cellsToAscii, cellsToPng, downloadText, fileToCells } from "@/lib/image";
import { api } from "@/lib/client";
import type { ConnectionView } from "@/lib/client";
import { cn } from "@/lib/cn";

type Props = {
  cells: number[];
  setCells: (updater: number[] | ((prev: number[]) => number[])) => void;
  painted: number[];
  name: string;
  setName: (s: string) => void;
  savedId: string | null;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  connection: ConnectionView | null;
  anchorDate: string | null;
};

export default function CanvasPanel({
  cells,
  setCells,
  painted,
  name,
  setName,
  savedId,
  dirty,
  saving,
  onSave,
  connection,
  anchorDate,
}: Props) {
  const [brush, setBrush] = useState(4);
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [text, setText] = useState("HELLO");
  const [sampleLogin, setSampleLogin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => summarize(cells), [cells]);
  const estimatedCommits = useMemo(
    () => cells.reduce((sum, v) => sum + commitsForLevel(v, 1), 0),
    [cells],
  );
  const busiestWeek = useMemo(() => {
    let best = 0;
    let bestCount = -1;
    for (let c = 0; c < COLS; c++) {
      let n = 0;
      for (let r = 0; r < ROWS; r++) n += cells[c * ROWS + r] > 0 ? 1 : 0;
      if (n > bestCount) {
        bestCount = n;
        best = c;
      }
    }
    return { week: best + 1, count: Math.max(0, bestCount) };
  }, [cells]);

  const notify = (tone: "ok" | "bad", text: string) => {
    setMessage({ tone, text });
    setTimeout(() => setMessage(null), 6000);
  };

  const paint = (index: number, value: number) =>
    setCells((prev) => setCell(prev, index, value));

  function loadPreset(id: string) {
    const found = PRESETS.find((p) => p.id === id);
    if (!found) return;
    setCells(found.build());
    notify("ok", `Loaded preset “${found.name}”.`);
  }

  function typeset() {
    const limit = maxTextLength();
    const value = text.slice(0, limit);
    if (!value.trim()) return;
    setCells((prev) => {
      const next = textToCells(value);
      // stamp over the current canvas instead of wiping it
      const merged = prev.slice();
      for (let i = 0; i < next.length; i++) if (next[i] > 0) merged[i] = clampLevel(next[i] || brush);
      return merged;
    });
    notify("ok", `Typeset “${value}” into the grid.`);
  }

  async function importImage(file: File) {
    setBusy("image");
    try {
      const next = await fileToCells(file);
      setCells(next);
      notify("ok", `Quantised ${file.name} onto 53×7.`);
    } catch (err) {
      notify("bad", err instanceof Error ? err.message : "image import failed");
    } finally {
      setBusy(null);
    }
  }

  async function sampleGitHub() {
    if (!connection) {
      notify("bad", "Connect a GitHub account first to sample a calendar.");
      return;
    }
    const login = (sampleLogin || connection.login).trim();
    setBusy("sample");
    try {
      const res = await api<{ cells: number[]; total: number }>(
        `/api/github/contributions?connectionId=${connection.id}&login=${encodeURIComponent(login)}`,
      );
      setCells(res.cells);
      notify("ok", `Sampled ${login}: ${res.total} contributions → bitmap.`);
    } catch (err) {
      notify("bad", err instanceof Error ? err.message : "sampling failed");
    } finally {
      setBusy(null);
    }
  }

  function noise(density = 0.42) {
    const next = emptyCells();
    for (let i = 0; i < next.length; i++) {
      if (Math.random() > density) continue;
      next[i] = 1 + Math.floor(Math.random() * 4);
    }
    setCells(next);
    notify("ok", "Scattered random activity.");
  }

  function exportPng() {
    const url = cellsToPng(cells);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase() || "bitmap"}.png`;
    a.click();
  }

  return (
    <Panel
      step="2"
      title="the canvas"
      subtitle="53 weeks × 7 days. Click or drag to paint, shift-click (or right-click) to erase."
      right={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              dirty ? "text-rust-400" : "text-jade-300",
            )}
          >
            {dirty ? "unsaved" : savedId ? "saved" : "not saved"}
          </span>
          <Button
            size="sm"
            variant={dirty ? "acid" : "outline"}
            onClick={onSave}
            disabled={saving}
            icon={saving ? <IconSpinner width={13} height={13} /> : <IconSave width={13} height={13} />}
          >
            save bitmap
          </Button>
        </div>
      }
    >
      {/* brush + transforms */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
            <IconBrush width={13} height={13} /> brush
          </span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <button
                key={level}
                onClick={() => setBrush(level)}
                title={level === 0 ? "eraser" : `${level} commit${level > 1 ? "s" : ""} / day`}
                className={cn(
                  `cell-${level} h-7 w-7 rounded-[3px] border transition-all`,
                  brush === level
                    ? "border-acid-400 shadow-[0_0_16px_-4px_rgba(200,247,81,0.9)] scale-110"
                    : "border-ink-600 hover:border-mist-400",
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setCells(emptyCells())}>
            clear
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCells((prev) => prev.map((v) => (v ? clampLevel(5 - v) : 0)))}
          >
            invert
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCells((prev) => mirrorCells(prev, "v"))}>
            mirror ↔
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCells((prev) => mirrorCells(prev, "h"))}>
            flip ↕
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCells((prev) => shiftColumns(prev, -1))}>
            ◀ shift
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCells((prev) => shiftColumns(prev, 1))}>
            shift ▶
          </Button>
          <Button size="sm" variant="ghost" onClick={() => noise()}>
            scatter
          </Button>
        </div>
      </div>

      {/* grid */}
      <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950/60 p-3 sm:p-4">
        <PixelGrid
          cells={cells}
          editable
          brush={brush}
          onPaint={paint}
          painted={painted}
          anchorDate={anchorDate}
          showLabels
        />
      </div>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mist-400">
        <IconGrid width={12} height={12} className="text-jade-300" />
        columns are weeks · rows are weekdays · a cell's level becomes that day's commit count
        {painted.length > 0 && (
          <span className="text-acid-300">· {painted.length} already committed</span>
        )}
      </p>

      {/* stats */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="pixels lit" value={stats.lit} sub={`of ${stats.total} cells`} accent />
        <Stat label="est. commits" value={estimatedCommits} sub="at 1× multiplier" />
        <Stat
          label="coverage"
          value={`${Math.round(stats.coverage * 100)}%`}
          sub="of the year"
        />
        <Stat label="busiest week" value={`#${busiestWeek.week}`} sub={`${busiestWeek.count} days`} />
      </div>

      {/* sources */}
      <div className="mt-5 space-y-3 border-t border-ink-700 pt-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
              preset library
            </span>
            <div className="flex gap-2">
              <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => loadPreset(preset)} icon={<IconWand width={13} height={13} />}>
                load
              </Button>
            </div>
          </div>

          <div className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
              typeset · 5×7 font · max {maxTextLength()} chars
            </span>
            <div className="flex gap-2">
              <TextInput
                value={text}
                maxLength={maxTextLength()}
                onChange={(e) => setText(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && typeset()}
                placeholder="HELLO"
              />
              <Button size="sm" onClick={typeset} icon={<IconType width={13} height={13} />}>
                stamp
              </Button>
            </div>
          </div>

          <div className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
              sample a real calendar
            </span>
            <div className="flex gap-2">
              <TextInput
                value={sampleLogin}
                onChange={(e) => setSampleLogin(e.target.value)}
                placeholder={connection?.login ?? "octocat"}
              />
              <Button
                size="sm"
                onClick={() => void sampleGitHub()}
                disabled={busy === "sample" || !connection}
                icon={
                  busy === "sample" ? (
                    <IconSpinner width={13} height={13} />
                  ) : (
                    <IconGitHub width={13} height={13} />
                  )
                }
              >
                pull
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importImage(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "image"}
            icon={
              busy === "image" ? <IconSpinner width={13} height={13} /> : <IconImage width={13} height={13} />
            }
          >
            import image
          </Button>
          <Button size="sm" variant="ghost" onClick={exportPng} icon={<IconDownload width={13} height={13} />}>
            export png
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              downloadText(
                `${name.replace(/\s+/g, "-").toLowerCase() || "bitmap"}.json`,
                JSON.stringify({ name, width: COLS, height: ROWS, cells }, null, 2),
              )
            }
            icon={<IconDownload width={13} height={13} />}
          >
            export json
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(cellsToAscii(cells));
              notify("ok", "ASCII bitmap copied to clipboard.");
            }}
          >
            copy ascii
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">name</span>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-44"
              placeholder="my bitmap"
            />
          </div>
        </div>

        {message && (
          <p
            className={cn(
              "rounded-md border p-2.5 font-mono text-[11px]",
              message.tone === "ok"
                ? "border-jade-400/30 bg-jade-400/5 text-jade-300"
                : "border-red-400/30 bg-red-400/5 text-red-300",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </Panel>
  );
}
