import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PixelGrid from "@shared/components/PixelGrid";
import { Button, Field, Meter, Panel, Select, Stat, StatusPill, TextInput } from "@shared/components/ui";
import { LogoMini } from "@shared/components/Logo";
import {
  IconBolt,
  IconBrush,
  IconGitHub,
  IconImage,
  IconPause,
  IconPlay,
  IconReset,
  IconSpinner,
  IconType,
  IconWand,
} from "@shared/components/Icons";
import {
  COLS,
  PRESETS,
  ROWS,
  anchorForWeeksBack,
  clampLevel,
  commitsForLevel,
  dateForCell,
  emptyCells,
  isoDate,
  mirrorCells,
  paintOrder,
  setCell,
  shiftColumns,
  summarize,
  textToCells,
} from "@shared/lib/grid";
import type { Cells, PaintOrder } from "@shared/lib/grid";
import { cellsToPng, fileToCells } from "@shared/lib/image";
import {
  ensureRepo,
  fetchContributions,
  getUser,
  listRepos,
  paintCommits,
  pollDeviceFlow,
  resolveCommitEmail,
  startDeviceFlow,
} from "@shared/lib/github";
import type { GitHubUser, RepoSummary } from "@shared/lib/github";
import { formatDuration, formatInterval } from "@shared/lib/client";
import { cn } from "@shared/lib/cn";

/* ---------------- storage ---------------- */

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`ppx.${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(`ppx.${key}`, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  },
  del(key: string) {
    localStorage.removeItem(`ppx.${key}`);
  },
};

type SavedPattern = { id: string; name: string; cells: number[] };
type LogLine = { id: number; level: "info" | "success" | "warn" | "error"; text: string; at: string };
type JobStatus = "idle" | "running" | "paused" | "done";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------- component ---------------- */

export default function Studio() {
  /* connection */
  const [token, setToken] = useState<string>(() => store.get("token", ""));
  const [user, setUser] = useState<GitHubUser | null>(() => store.get("user", null));
  const [pat, setPat] = useState("");
  const [clientIdInput, setClientIdInput] = useState(
    () => store.get("clientId", "") || (import.meta.env.VITE_GITHUB_CLIENT_ID ?? ""),
  );
  const [oauthCfg, setOauthCfg] = useState<{ clientId: string | null; webFlowReady: boolean } | null>(null);
  const [device, setDevice] = useState<{ code: string; userCode: string; uri: string } | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  /* canvas */
  const [cells, setCells] = useState<Cells>(() => PRESETS[0].build());
  const [name, setName] = useState(PRESETS[0].name);
  const [brush, setBrush] = useState(4);
  const [text, setText] = useState("HELLO");
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [saved, setSaved] = useState<SavedPattern[]>(() => store.get("patterns", []));

  /* job */
  const [mode, setMode] = useState<"github" | "simulate">("simulate");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [intervalSec, setIntervalSec] = useState(10);
  const [perTick, setPerTick] = useState(4);
  const [mult, setMult] = useState(1);
  const [order, setOrder] = useState<PaintOrder>("column");
  const [status, setStatus] = useState<JobStatus>("idle");
  const [painted, setPainted] = useState<number[]>([]);
  const [commits, setCommits] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);

  /* verify */
  const [verifyLogin, setVerifyLogin] = useState("");
  const [actual, setActual] = useState<number[] | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  /* repositories list */
  const [userRepos, setUserRepos] = useState<RepoSummary[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const cachedRepoRef = useRef<{ key: string; repo: RepoSummary } | null>(null);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const jobRef = useRef({ status, painted, mode, intervalSec, perTick, mult, order, repoName, branch });
  jobRef.current = { status, painted, mode, intervalSec, perTick, mult, order, repoName, branch };
  const anchorRef = useRef<string>(anchorForWeeksBack(52));
  const nextAtRef = useRef<number>(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const stats = useMemo(() => summarize(cells), [cells]);
  const litIndexes = useMemo(() => paintOrder(cells, order), [cells, order]);

  const say = (tone: "ok" | "bad", textMsg: string) => {
    setNotice({ tone, text: textMsg });
    setTimeout(() => setNotice(null), 6000);
  };
  const pushLog = useCallback((level: LogLine["level"], textMsg: string) => {
    setLog((prev) => [
      ...prev.slice(-80),
      { id: Date.now() + Math.random(), level, text: textMsg, at: new Date().toISOString().slice(11, 19) },
    ]);
  }, []);

  const loadUserRepos = useCallback(async (activeToken?: string) => {
    const tk = (activeToken || store.get<string>("token", "")).trim();
    if (!tk) return;
    setReposLoading(true);
    try {
      const list = await listRepos(tk);
      setUserRepos(list);
    } catch {
      /* ignore background list error */
    } finally {
      setReposLoading(false);
    }
  }, []);

  /* ---------- connection ---------- */

  const applyToken = useCallback(
    async (next: string) => {
      const me = await getUser(next);
      setToken(next);
      setUser(me);
      store.set("token", next);
      store.set("user", me);
      if (!repoName) setRepoName(`${me.login.toLowerCase()}-pixels`);
      cachedRepoRef.current = null;
      say("ok", `Connected as ${me.login}`);
      void loadUserRepos(next);
      return me;
    },
    [repoName, loadUserRepos],
  );

  // OAuth config + callback handling
  useEffect(() => {
    fetch("/api/oauth-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.clientId) setOauthCfg({ clientId: cfg.clientId, webFlowReady: Boolean(cfg.webFlowReady) });
      })
      .catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      setConnectBusy(true);
      fetch("/api/oauth-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, redirectUri: window.location.origin + window.location.pathname }),
      })
        .then(async (r) => {
          const json = (await r.json()) as { accessToken?: string; error?: string };
          if (!json.accessToken) throw new Error(json.error ?? "exchange failed");
          return applyToken(json.accessToken);
        })
        .catch((err) => say("bad", `OAuth failed: ${err instanceof Error ? err.message : String(err)}`))
        .finally(() => setConnectBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.split("preset=")[1];
    if (fromHash) {
      const found = PRESETS.find((p) => p.id === fromHash.split("&")[0]);
      if (found) {
        setCells(found.build());
        setName(found.name);
        setPresetId(found.id);
      }
    }
  }, []);

  async function connectPat() {
    if (!pat.trim()) return;
    setConnectBusy(true);
    try {
      await applyToken(pat.trim());
      setPat("");
    } catch (err) {
      say("bad", `Token rejected: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnectBusy(false);
    }
  }

  async function connectDevice() {
    const cid = clientIdInput.trim();
    if (!cid) {
      say("bad", "Paste your GitHub OAuth App Client ID first (no secret needed for device flow).");
      return;
    }
    store.set("clientId", cid);
    setConnectBusy(true);
    try {
      const start = await startDeviceFlow(cid);
      setDevice({ code: start.device_code, userCode: start.user_code, uri: start.verification_uri });
      const poll = async (wait: number): Promise<void> => {
        const res = await pollDeviceFlow(start.device_code, cid);
        if (res.status === "authorized") {
          setDevice(null);
          await applyToken(res.accessToken);
          return;
        }
        if (res.status === "error") {
          setDevice(null);
          say("bad", `Device flow failed: ${res.error}`);
          return;
        }
        const next = res.status === "slow_down" ? (res.interval + 5) * 1000 : wait;
        setTimeout(() => void poll(next).catch(() => undefined), next);
      };
      setTimeout(() => void poll(Math.max(5, start.interval) * 1000), Math.max(5, start.interval) * 1000);
    } catch (err) {
      say("bad", `Could not start device flow: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConnectBusy(false);
    }
  }

  function oauthAuthorizeUrl() {
    if (!oauthCfg?.clientId) return "#";
    const params = new URLSearchParams({
      client_id: oauthCfg.clientId,
      redirect_uri: window.location.origin + window.location.pathname,
      scope: "repo read:user user:email",
      state: Math.random().toString(36).slice(2),
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  function disconnect() {
    setToken("");
    setUser(null);
    setUserRepos([]);
    cachedRepoRef.current = null;
    store.del("token");
    store.del("user");
    say("ok", "Disconnected. The token was removed from this browser.");
  }

  /* ---------- job engine (in-tab interval painter) ---------- */

  const tick = useCallback(async () => {
    const job = jobRef.current;
    if (job.status !== "running") return;
    const all = paintOrder(cellsRef.current, job.order);
    const paintedSet = new Set(job.painted);
    const remaining = all.filter((i) => !paintedSet.has(i));
    const batch = remaining.slice(0, Math.max(1, job.perTick));
    if (!batch.length) {
      setStatus("done");
      pushLog("success", "Bitmap complete — every lit pixel is painted.");
      return;
    }

    let created = 0;
    if (job.mode === "github") {
      const tk = store.get<string>("token", "");
      const me = store.get<GitHubUser | null>("user", null);
      if (!tk || !me) {
        setStatus("paused");
        pushLog("error", "GitHub mode needs a connection — job paused.");
        return;
      }
      try {
        const email = await resolveCommitEmail(tk, me.login, me.id);
        const targetRepoName = (job.repoName || `${me.login}-pixels`).trim();
        let repo: RepoSummary;
        if (cachedRepoRef.current && cachedRepoRef.current.key === targetRepoName) {
          repo = cachedRepoRef.current.repo;
        } else {
          repo = await ensureRepo(tk, targetRepoName, false);
          cachedRepoRef.current = { key: targetRepoName, repo };
        }
        const ceiling = Date.now() - 120_000;
        let clamped = 0;
        const requests: { message: string; date: string }[] = [];
        for (const index of batch) {
          const level = clampLevel(cellsRef.current[index] ?? 0);
          const count = commitsForLevel(level, job.mult);
          const when = dateForCell(anchorRef.current, index, 12);
          when.setUTCMinutes((index * 11) % 55, (index * 7) % 60);
          if (when.getTime() > ceiling) {
            when.setTime(ceiling - clamped * 61_000);
            clamped += 1;
          }
          for (let k = 0; k < count; k++) {
            requests.push({
              message: `paint: w${Math.floor(index / ROWS) + 1}/d${(index % ROWS) + 1} · level ${level}`,
              date: new Date(when.getTime() + k * 61_000).toISOString(),
            });
          }
        }
        const result = await paintCommits(tk, {
          repo: repo.full_name,
          branch: job.branch,
          path: ".paint/pixels.txt",
          authorName: me.name ?? me.login,
          authorEmail: email,
          requests,
          content: `# pixelpunisher.x manifest\n\npainted ${paintedSet.size + batch.length} cells · ${new Date().toISOString()}\n`,
        });
        created = result.commits;
      } catch (err) {
        cachedRepoRef.current = null;
        setStatus("paused");
        pushLog("error", `Paint failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    } else {
      created = batch.reduce((s, i) => s + commitsForLevel(cellsRef.current[i] ?? 0, job.mult), 0);
    }

    const nextPainted = [...paintedSet, ...batch];
    setPainted(nextPainted);
    setCommits((c) => c + created);
    const left = remaining.length - batch.length;
    if (left <= 0) {
      setStatus("done");
      pushLog("success", `Final tick: ${batch.length} cells, ${created} commits. Bitmap complete.`);
    } else {
      pushLog(
        "info",
        `Tick: ${batch.length} cells (${created} commits${job.mode === "github" ? " pushed" : " simulated"}) — ${left} to go.`,
      );
    }
    nextAtRef.current = Date.now() + job.intervalSec * 1000;
  }, [pushLog]);

  useEffect(() => {
    const t = setInterval(() => {
      if (jobRef.current.status === "running") {
        setCountdown(Math.max(0, nextAtRef.current - Date.now()));
        if (Date.now() >= nextAtRef.current) void tick();
      } else {
        setCountdown(null);
      }
    }, 500);
    return () => clearInterval(t);
  }, [tick]);

  function arm() {
    cachedRepoRef.current = null;
    anchorRef.current = anchorForWeeksBack(52);
    setPainted([]);
    setCommits(0);
    setLog([]);
    setStatus("running");
    nextAtRef.current = Date.now() + 800;
    pushLog(
      "info",
      `Armed: ${stats.lit} lit cells, ${perTick} cells ${formatInterval(intervalSec)} (${mode} mode).`,
    );
  }

  /* ---------- canvas helpers ---------- */

  function savePattern() {
    const entry: SavedPattern = { id: uid(), name: name || "untitled", cells };
    const next = [entry, ...saved].slice(0, 24);
    setSaved(next);
    store.set("patterns", next);
    say("ok", `Saved “${entry.name}” to this browser.`);
  }

  async function importImage(file: File) {
    try {
      setCells(await fileToCells(file));
      say("ok", `Quantised ${file.name} onto 53×7.`);
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "image import failed");
    }
  }

  async function sampleCalendar() {
    if (!token || !user) {
      say("bad", "Connect GitHub first to sample a calendar.");
      return;
    }
    setVerifyBusy(true);
    try {
      const grid = await fetchContributions(token, user.login);
      const weeks = grid.weeks.slice(-COLS);
      const offset = COLS - weeks.length;
      const next = emptyCells();
      weeks.forEach((week, wi) => {
        for (let d = 0; d < ROWS; d++) next[(wi + offset) * ROWS + d] = clampLevel(week[d]?.level ?? 0);
      });
      setActual(next);
      say("ok", `Sampled ${user.login}: ${grid.total} contributions.`);
    } catch (err) {
      say("bad", err instanceof Error ? err.message : "sampling failed");
    } finally {
      setVerifyBusy(false);
    }
  }

  const progress = stats.lit
    ? {
        done: painted.length,
        percent: Math.min(100, Math.round((painted.length / stats.lit) * 100)),
        remaining: stats.lit - painted.length,
      }
    : { done: 0, percent: 0, remaining: 0 };

  const diff = useMemo(() => {
    if (!actual) return null;
    let match = 0;
    for (let i = 0; i < COLS * ROWS; i++) if ((actual[i] ?? 0) === (cells[i] ?? 0)) match++;
    return { match, accuracy: Math.round((match / (COLS * ROWS)) * 100) };
  }, [actual, cells]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight tracking-tight text-mist-100">
            Design once. Let the interval do the committing.
          </h1>
          <p className="mt-2 max-w-[80ch] text-[13.5px] leading-relaxed text-mist-400">
            This Vite edition runs the painter in your browser: connect, draw, arm, and keep the tab
            open while it ticks. Patterns and tokens stay in this browser's local storage.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-ink-600 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-300">
          <LogoMini size={14} /> vite edition
        </span>
      </div>

      {notice && (
        <p
          className={cn(
            "mb-4 rounded-md border p-3 font-mono text-[11.5px]",
            notice.tone === "ok"
              ? "border-jade-400/40 bg-jade-400/5 text-jade-300"
              : "border-red-400/40 bg-red-400/5 text-red-300",
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)_400px]">
        {/* -------- connect -------- */}
        <div className="space-y-4">
          <Panel
            step="1"
            title="connect github"
            subtitle="OAuth via Vercel Function, device flow, or a token — all browser-direct after that."
          >
            {user ? (
              <div className="flex items-center gap-3 rounded-md border border-acid-400/50 bg-acid-400/5 px-3 py-2.5">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-md border border-ink-600" />
                ) : (
                  <IconGitHub width={18} height={18} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12.5px] text-mist-100">{user.login}</div>
                  <div className="truncate text-[11px] text-mist-400">{user.email ?? "no email on file"}</div>
                </div>
                <Button size="sm" variant="danger" onClick={disconnect}>
                  disconnect
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {oauthCfg?.webFlowReady ? (
                  <a
                    href={oauthAuthorizeUrl()}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-acid-400 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-colors hover:bg-acid-300"
                  >
                    <IconGitHub width={15} height={15} /> authorize with github
                  </a>
                ) : (
                  <p className="rounded-md border border-ink-700 bg-ink-850/50 p-2.5 text-[11.5px] leading-relaxed text-mist-400">
                    OAuth web flow activates when this deployment has{" "}
                    <span className="font-mono text-mist-200">GITHUB_CLIENT_ID</span> /{" "}
                    <span className="font-mono text-mist-200">GITHUB_CLIENT_SECRET</span> set (the
                    exchange runs in <span className="font-mono text-mist-200">/api/oauth-exchange</span>).
                    Device flow below needs only a Client ID.
                  </p>
                )}

                <Field label="oauth app client id (device flow)">
                  <div className="flex gap-2">
                    <TextInput
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="Iv1.…"
                    />
                    <Button size="sm" onClick={() => void connectDevice()} disabled={connectBusy}>
                      device
                    </Button>
                  </div>
                </Field>
                {device && (
                  <div className="rounded-md border border-jade-500/40 bg-jade-500/5 p-3">
                    <div className="text-[12px] text-mist-200">
                      Open{" "}
                      <a href={device.uri} target="_blank" rel="noreferrer" className="font-mono text-acid-300 underline decoration-dotted">
                        {device.uri}
                      </a>{" "}
                      and enter
                    </div>
                    <div className="mt-2 rounded border border-ink-600 bg-ink-950 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-acid-400">
                      {device.userCode}
                    </div>
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-mist-400">
                      <IconSpinner width={12} height={12} /> waiting for approval…
                    </div>
                  </div>
                )}

                <Field
                  label="or paste a personal access token"
                  hint={
                    <span className="block space-y-1">
                      <span className="block">
                        <strong>Classic PAT:</strong> check the <code className="text-mist-200">repo</code> scope.
                      </span>
                      <span className="block">
                        <strong>Fine-grained PAT:</strong> set <em>Repository permissions → Contents: Read and write</em>, and include your repository under <em>Repository access</em>.
                      </span>
                    </span>
                  }
                >
                  <div className="flex gap-2">
                    <TextInput
                      type="password"
                      value={pat}
                      onChange={(e) => setPat(e.target.value)}
                      placeholder="ghp_… or github_pat_…"
                      onKeyDown={(e) => e.key === "Enter" && void connectPat()}
                    />
                    <Button size="sm" variant="acid" onClick={() => void connectPat()} disabled={connectBusy || !pat.trim()}>
                      {connectBusy ? <IconSpinner width={13} height={13} /> : "connect"}
                    </Button>
                  </div>
                </Field>
              </div>
            )}
          </Panel>

          <Panel title="pattern library" subtitle="Presets plus everything you save in this browser.">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setCells(p.build());
                    setName(p.name);
                    setPresetId(p.id);
                  }}
                  className={cn(
                    "rounded-md border p-2 text-left transition-colors",
                    presetId === p.id ? "border-acid-400/60 bg-acid-400/5" : "border-ink-700 bg-ink-850/40 hover:border-ink-500",
                  )}
                >
                  <PixelGrid cells={p.build()} compact />
                  <div className="mt-1.5 truncate font-mono text-[9.5px] uppercase tracking-[0.1em] text-mist-200">
                    {p.name}
                  </div>
                </button>
              ))}
            </div>
            {saved.length > 0 && (
              <div className="mt-3 border-t border-ink-700 pt-3">
                <div className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mist-400">saved here</div>
                <ul className="space-y-1.5">
                  {saved.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          setCells(p.cells);
                          setName(p.name);
                        }}
                        className="w-full rounded-md border border-ink-700 bg-ink-850/40 px-2.5 py-2 text-left font-mono text-[11px] text-mist-200 hover:border-ink-500"
                      >
                        {p.name}
                        <span className="float-right text-mist-400">{p.cells.filter((c) => c > 0).length}px</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>

        {/* -------- canvas -------- */}
        <Panel
          step="2"
          title="the canvas"
          subtitle="53 weeks × 7 days. Click or drag to paint, shift-click to erase."
          right={
            <Button size="sm" variant="acid" onClick={savePattern}>
              save bitmap
            </Button>
          }
        >
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
                      brush === level ? "scale-110 border-acid-400" : "border-ink-600 hover:border-mist-400",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setCells(emptyCells())}>clear</Button>
              <Button size="sm" variant="ghost" onClick={() => setCells((p) => p.map((v) => (v ? clampLevel(5 - v) : 0)))}>invert</Button>
              <Button size="sm" variant="ghost" onClick={() => setCells((p) => mirrorCells(p, "v"))}>mirror ↔</Button>
              <Button size="sm" variant="ghost" onClick={() => setCells((p) => shiftColumns(p, 1))}>shift ▶</Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-ink-700 bg-ink-950/60 p-3 sm:p-4">
            <PixelGrid cells={cells} editable brush={brush} onPaint={(i, v) => setCells((p) => setCell(p, i, v))} painted={painted} anchorDate={anchorRef.current} showLabels />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat label="pixels lit" value={stats.lit} sub={`of ${stats.total}`} accent />
            <Stat label="est. commits" value={cells.reduce((s, v) => s + commitsForLevel(v, 1), 0)} sub="at 1×" />
            <Stat label="painted" value={painted.length} sub={status} />
          </div>

          <div className="mt-4 grid gap-3 border-t border-ink-700 pt-4 md:grid-cols-3">
            <Field label="typeset · 5×7 font">
              <div className="flex gap-2">
                <TextInput value={text} maxLength={8} onChange={(e) => setText(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && setCells(textToCells(text))} />
                <Button size="sm" onClick={() => setCells(textToCells(text))} icon={<IconType width={13} height={13} />}>stamp</Button>
              </div>
            </Field>
            <Field label="pattern name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="image / exports">
              <div className="flex flex-wrap gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-500 bg-ink-850 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist-200 hover:border-jade-300/60">
                  <IconImage width={13} height={13} /> import
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importImage(f); e.target.value = ""; }} />
                </label>
                <Button size="sm" variant="ghost" onClick={() => { const a = document.createElement("a"); a.href = cellsToPng(cells); a.download = "pixelpunisher.png"; a.click(); }}>png</Button>
                <Button size="sm" variant="ghost" onClick={() => void sampleCalendar()} disabled={verifyBusy || !token}>
                  {verifyBusy ? <IconSpinner width={13} height={13} /> : "sample mine"}
                </Button>
              </div>
            </Field>
          </div>
        </Panel>

        {/* -------- schedule -------- */}
        <div className="space-y-4">
          <Panel
            step="3"
            title="the interval"
            subtitle="Runs in this tab — keep it open while it paints."
            right={<StatusPill status={status} pulse />}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["github", "simulate"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={m === "github" && !token}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-left transition-all disabled:opacity-40",
                      mode === m ? "border-acid-400/60 bg-acid-400/5" : "border-ink-700 bg-ink-850/50 hover:border-ink-500",
                    )}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-mist-100">
                      {m === "github" ? "paint to github" : "simulate offline"}
                    </div>
                    <div className="mt-1 text-[11px] leading-snug text-mist-400">
                      {m === "github" ? "real commits via the Git Data API" : "identical loop, virtual canvas"}
                    </div>
                  </button>
                ))}
              </div>

              {mode === "github" && (
                <div className="space-y-3">
                  <Field
                    label="target repository"
                    hint={
                      <span>
                        Must be standalone (not a fork) to count on your graph.{" "}
                        <a
                          href="https://github.com/new"
                          target="_blank"
                          rel="noreferrer"
                          className="text-acid-300 underline decoration-dotted hover:text-acid-400"
                        >
                          Create empty repo on GitHub ↗
                        </a>
                      </span>
                    }
                  >
                    <div className="flex gap-2">
                      <TextInput
                        value={repoName}
                        onChange={(e) => {
                          setRepoName(e.target.value);
                          cachedRepoRef.current = null;
                        }}
                        placeholder={`${user?.login ?? "you"}-pixels`}
                      />
                      <Button
                        size="sm"
                        onClick={() => void loadUserRepos()}
                        disabled={reposLoading || !token}
                        title="Load your repositories"
                      >
                        {reposLoading ? <IconSpinner width={13} height={13} /> : "list"}
                      </Button>
                    </div>
                  </Field>

                  {userRepos.length > 0 && (
                    <Field label="or select from your existing repositories">
                      <Select
                        value={repoName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = userRepos.find((r) => r.name === val || r.full_name === val);
                          if (found) {
                            setRepoName(found.name);
                            setBranch(found.default_branch || "main");
                            cachedRepoRef.current = null;
                          } else if (val) {
                            setRepoName(val);
                            cachedRepoRef.current = null;
                          }
                        }}
                      >
                        <option value="">— select an existing repository —</option>
                        {userRepos.map((r) => (
                          <option key={r.full_name} value={r.name}>
                            {r.full_name} {r.private ? "(private)" : ""} {r.fork ? "(fork — won't count)" : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="tick interval">
                  <Select value={String(intervalSec)} onChange={(e) => setIntervalSec(Number(e.target.value))}>
                    {[5, 10, 30, 60, 300, 900, 3600].map((v) => (
                      <option key={v} value={v}>{formatInterval(v)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="cells per tick">
                  <Select value={String(perTick)} onChange={(e) => setPerTick(Number(e.target.value))}>
                    {[1, 2, 4, 6, 8, 12, 20, 40].map((v) => (
                      <option key={v} value={v}>{v} cells</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="paint order">
                  <Select value={order} onChange={(e) => setOrder(e.target.value as PaintOrder)}>
                    <option value="column">week by week</option>
                    <option value="row">day by day</option>
                    <option value="intensity">darkest first</option>
                    <option value="spiral">centre outwards</option>
                    <option value="random">shuffled</option>
                  </Select>
                </Field>
                <Field label="commit multiplier">
                  <Select value={String(mult)} onChange={(e) => setMult(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((v) => (
                      <option key={v} value={v}>{v}× ({v}–{v * 4}/day)</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-mist-400">
                  <span>bitmap developed</span>
                  <span className="text-acid-300">{progress.percent}%</span>
                </div>
                <Meter percent={progress.percent} />
                <div className="mt-2 flex justify-between font-mono text-[10.5px] text-mist-400">
                  <span>{progress.done}/{stats.lit} cells · {commits} commits</span>
                  <span>{status === "running" && countdown !== null ? `next tick ${formatDuration(countdown)}` : status}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {status === "running" ? (
                  <Button variant="outline" onClick={() => setStatus("paused")} icon={<IconPause width={13} height={13} />}>pause</Button>
                ) : (
                  <Button variant="acid" onClick={arm} disabled={!stats.lit || status === "done" && painted.length >= stats.lit} icon={<IconPlay width={13} height={13} />}>
                    {status === "done" ? "finished" : painted.length ? "resume" : "arm painter"}
                  </Button>
                )}
                <Button onClick={() => { nextAtRef.current = 0; if (status !== "running") { setStatus("running"); } void tick(); }} disabled={!stats.lit} icon={<IconBolt width={13} height={13} />}>tick now</Button>
                <Button variant="ghost" onClick={() => { setStatus("idle"); setPainted([]); setCommits(0); pushLog("warn", "Canvas wiped."); }} icon={<IconReset width={13} height={13} />}>reset</Button>
              </div>
              {status === "done" && (
                <Button variant="ghost" onClick={() => { setStatus("idle"); setPainted([]); setCommits(0); }}>paint it again</Button>
              )}

              <p className="text-[11.5px] leading-relaxed text-mist-400">
                {litIndexes.length} lit cells in this order · finishes in ≈
                {formatDuration(Math.ceil(stats.lit / Math.max(1, perTick)) * intervalSec * 1000)} at this cadence.
              </p>
            </div>
          </Panel>

          <Panel title="run log" subtitle="Every tick writes here.">
            <div className="h-44 space-y-1.5 overflow-y-auto rounded-md border border-ink-700 bg-ink-950/70 p-3 font-mono text-[11px] leading-relaxed">
              {log.length === 0 && <div className="text-mist-400">no ticks yet — arm the painter.</div>}
              {log.map((l) => (
                <div key={l.id} className="flex gap-2.5">
                  <span className="shrink-0 text-mist-400/60">{l.at}</span>
                  <span className={cn(l.level === "error" && "text-red-300", l.level === "success" && "text-jade-300", l.level === "warn" && "text-rust-400", l.level === "info" && "text-mist-200")}>
                    {l.text}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel step="4" title="verify against github" subtitle="Pull the real calendar back and diff it against your design.">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1">
                <Field label="github login">
                  <TextInput value={verifyLogin} onChange={(e) => setVerifyLogin(e.target.value)} placeholder={user?.login ?? "octocat"} />
                </Field>
              </div>
              <Button
                variant="acid"
                disabled={verifyBusy || !token}
                onClick={async () => {
                  if (!token) return;
                  setVerifyBusy(true);
                  try {
                    const grid = await fetchContributions(token, (verifyLogin || user?.login || "").trim());
                    const weeks = grid.weeks.slice(-COLS);
                    const offset = COLS - weeks.length;
                    const next = emptyCells();
                    weeks.forEach((week, wi) => {
                      for (let d = 0; d < ROWS; d++) next[(wi + offset) * ROWS + d] = clampLevel(week[d]?.level ?? 0);
                    });
                    setActual(next);
                  } catch (err) {
                    say("bad", err instanceof Error ? err.message : "fetch failed");
                  } finally {
                    setVerifyBusy(false);
                  }
                }}
                icon={verifyBusy ? <IconSpinner width={14} height={14} /> : <IconWand width={14} height={14} />}
              >
                fetch calendar
              </Button>
              {token && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const repos = await listRepos(token);
                      say("ok", `${repos.length} repositories visible to this token.`);
                    } catch (err) {
                      say("bad", err instanceof Error ? err.message : "repo list failed");
                    }
                  }}
                >
                  test token
                </Button>
              )}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400">your design</div>
                <div className="rounded-md border border-ink-700 bg-ink-950/60 p-2.5">
                  <PixelGrid cells={cells} compact />
                </div>
              </div>
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-mist-400">github reports</div>
                <div className="rounded-md border border-ink-700 bg-ink-950/60 p-2.5">
                  {actual ? (
                    <PixelGrid cells={actual} overlay={cells} compact />
                  ) : (
                    <div className="hatch flex h-[74px] items-center justify-center rounded font-mono text-[10.5px] text-mist-400">
                      awaiting a fetch
                    </div>
                  )}
                </div>
              </div>
            </div>
            {diff && (
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                <Stat label="match" value={`${diff.accuracy}%`} accent />
                <Stat label="cells matching" value={diff.match} sub={`of ${COLS * ROWS}`} />
                <Stat label="anchor" value={isoDate(new Date(anchorRef.current)).slice(5)} sub="first column" />
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
