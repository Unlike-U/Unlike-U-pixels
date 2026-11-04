"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Panel, TextInput } from "@/components/ui";
import {
  IconArrowRight,
  IconCheck,
  IconGitHub,
  IconLink,
  IconSpinner,
  IconTrash,
  IconWarn,
} from "@/components/Icons";
import { api, post } from "@/lib/client";
import type { ConnectionView } from "@/lib/client";
import { cn } from "@/lib/cn";

export type OAuthConfig = {
  clientId: string | null;
  source: "env" | "database" | "none";
  webFlowReady: boolean;
  deviceFlowReady: boolean;
  scopes: string;
  origin: string;
  callbackUrl: string;
};

type Props = {
  connections: ConnectionView[];
  activeId: string | null;
  onActive: (id: string | null) => void;
  onChanged: () => Promise<void> | void;
  oauth: OAuthConfig | null;
  schedulerOnline: boolean;
};

type DeviceStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
};

type PollResult = {
  status: "pending" | "slow_down" | "error" | "authorized";
  interval?: number;
  error?: string;
  connection?: ConnectionView;
};

type Tab = "oauth" | "device" | "pat";

export default function ConnectPanel({
  connections,
  activeId,
  onActive,
  onChanged,
  oauth,
  schedulerOnline,
}: Props) {
  const [tab, setTab] = useState<Tab>("oauth");
  const [device, setDevice] = useState<DeviceStart | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  const webReady = oauth?.webFlowReady ?? false;
  const deviceReady = oauth?.deviceFlowReady ?? false;

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!webReady && tab === "oauth") {
      if (deviceReady) setTab("device");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webReady, deviceReady]);

  /* ------------- oauth app setup ------------- */

  async function saveCreds() {
    setSavingCreds(true);
    setError(null);
    try {
      await post<OAuthConfig>("/api/auth/github/config", { clientId, clientSecret });
      setClientSecret("");
      setNotice("OAuth App saved. You can now run the redirect flow.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save the credentials");
    } finally {
      setSavingCreds(false);
    }
  }

  async function clearCreds() {
    setBusy(true);
    try {
      await api("/api/auth/github/config", { method: "DELETE" });
      setNotice("Stored OAuth App credentials cleared.");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not clear credentials");
    } finally {
      setBusy(false);
    }
  }

  /* ------------- device flow ------------- */

  async function startDeviceFlow() {
    setBusy(true);
    setError(null);
    try {
      const res = await post<DeviceStart>("/api/auth/device/start", {});
      setDevice(res);
      void poll(res.deviceCode, Math.max(3, res.interval), oauth?.clientId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function poll(deviceCode: string, interval: number, cid: string) {
    if (cancelled.current) return;
    try {
      const res = await post<PollResult>("/api/auth/device/poll", {
        deviceCode,
        clientId: cid,
      });
      if (cancelled.current) return;
      if (res.status === "authorized" && res.connection) {
        setDevice(null);
        setNotice(`Connected as ${res.connection.login}`);
        onActive(res.connection.id);
        await onChanged();
        return;
      }
      if (res.status === "error") {
        setError(`GitHub refused the handshake: ${res.error}`);
        setDevice(null);
        return;
      }
      const wait = (res.status === "slow_down" ? (res.interval ?? interval) + 5 : interval) * 1000;
      timer.current = setTimeout(() => void poll(deviceCode, wait / 1000, cid), wait);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDevice(null);
    }
  }

  /* ------------- pat ------------- */

  async function connectPat() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ connection: ConnectionView }>("/api/auth/token", {
        token: token.trim(),
      });
      setNotice(`Connected as ${res.connection.login}`);
      setToken("");
      onActive(res.connection.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    setBusy(true);
    try {
      await api(`/api/connections/${id}`, { method: "DELETE" });
      if (activeId === id) onActive(null);
      await onChanged();
      setNotice("Connection removed and its jobs deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const TABS: { id: Tab; label: string; enabled: boolean; badge?: string }[] = [
    { id: "oauth", label: "oauth app", enabled: true, badge: webReady ? "ready" : "setup" },
    { id: "device", label: "device flow", enabled: deviceReady },
    { id: "pat", label: "token", enabled: true },
  ];

  return (
    <Panel
      step="1"
      title="connect github"
      subtitle="OAuth is the intended path — the token is AES-256-GCM encrypted before it's stored."
      right={
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em]",
            schedulerOnline
              ? "border-jade-400/40 bg-jade-400/10 text-jade-300"
              : "border-rust-400/40 bg-rust-400/10 text-rust-400",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full bg-current", schedulerOnline && "animate-blink")} />
          scheduler {schedulerOnline ? "online" : "offline"}
        </span>
      }
    >
      {connections.length > 0 && (
        <ul className="mb-4 space-y-2">
          {connections.map((c) => (
            <li key={c.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                  activeId === c.id
                    ? "border-acid-400/60 bg-acid-400/5"
                    : "border-ink-700 bg-ink-850/50 hover:border-ink-500",
                )}
              >
                <button
                  onClick={() => onActive(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  disabled={busy}
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.avatarUrl}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-md border border-ink-600"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-600 text-mist-300">
                      <IconGitHub width={15} height={15} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12px] text-mist-100">
                      {c.login}
                      {activeId === c.id && (
                        <IconCheck width={11} height={11} className="ml-1.5 inline text-acid-400" />
                      )}
                    </span>
                    <span className="block truncate text-[10.5px] text-mist-400">
                      {c.mode === "oauth" ? "oauth token" : "personal token"} · {c.email ?? "no email"}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => void disconnect(c.id)}
                  className="shrink-0 rounded p-1.5 text-mist-400 transition-colors hover:bg-rust-400/10 hover:text-rust-400"
                  aria-label={`disconnect ${c.login}`}
                >
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border border-ink-700 bg-ink-950/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => t.enabled && setTab(t.id)}
            disabled={!t.enabled}
            title={t.enabled ? undefined : "needs a GitHub OAuth App client id"}
            className={cn(
              "rounded px-1 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-colors disabled:opacity-30",
              tab === t.id ? "bg-ink-700 text-acid-300" : "text-mist-400 hover:text-mist-200",
            )}
          >
            {t.label}
            {t.badge && tab !== t.id && (
              <span
                className={cn(
                  "ml-1 inline-block h-1 w-1 rounded-full align-middle",
                  t.badge === "ready" ? "bg-jade-400" : "bg-rust-400",
                )}
              />
            )}
          </button>
        ))}
      </div>

      {/* ---------------- OAuth web flow ---------------- */}
      {tab === "oauth" && (
        <div className="space-y-3">
          {webReady ? (
            <>
              <a
                href="/api/auth/github/start"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-acid-400 px-3.5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 transition-all hover:bg-acid-300 hover:shadow-[0_0_28px_-8px_rgba(200,247,81,0.9)]"
              >
                <IconGitHub width={16} height={16} />
                authorize with github
                <IconArrowRight width={13} height={13} />
              </a>
              <p className="text-[11.5px] leading-relaxed text-mist-400">
                This runs the standard OAuth authorization-code flow: you approve on{" "}
                <span className="font-mono text-mist-200">github.com</span>, GitHub redirects back to
                this app, and the one-time code is exchanged server-side for a user token. Scopes
                requested: <span className="font-mono text-mist-200">{oauth?.scopes}</span>.
              </p>
            </>
          ) : (
            <>
              <div className="rounded-md border border-rust-400/30 bg-rust-400/5 p-3">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-rust-400">
                  <IconWarn width={13} height={13} /> one-time setup
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-mist-300">
                  Paste the credentials of a GitHub OAuth App below to switch on the redirect flow.
                  Takes about a minute.
                </p>
              </div>

              <ol className="space-y-2.5 text-[12px] leading-relaxed text-mist-300">
                <li className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-mono text-[9px] text-acid-300">
                    1
                  </span>
                  <span>
                    Open{" "}
                    <a
                      href="https://github.com/settings/developers"
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-acid-300 underline decoration-dotted"
                    >
                      Settings → Developer settings → OAuth Apps
                    </a>{" "}
                    and press <span className="font-mono text-mist-100">New OAuth App</span>.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-ink-700 font-mono text-[9px] text-acid-300">
                    2
                  </span>
                  <span>
                    Name it anything. Homepage URL can be this origin. Set the{" "}
                    <strong className="text-mist-100">Authorization callback URL</strong> to exactly:
                  </span>
                </li>
              </ol>

              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(oauth?.callbackUrl ?? "");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="group flex w-full items-center justify-between gap-2 rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 text-left transition-colors hover:border-acid-400/50"
              >
                <span className="truncate font-mono text-[11px] text-acid-300">
                  {oauth?.callbackUrl ?? "…"}
                </span>
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-mist-400 group-hover:text-mist-100">
                  {copied ? "copied" : "copy"}
                </span>
              </button>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="client id">
                  <TextInput
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value.trim())}
                    placeholder="Iv1.9a1b2c3d4e5f6g7h"
                  />
                </Field>
                <Field label="client secret">
                  <TextInput
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value.trim())}
                    placeholder="••••••••••••••••••••"
                  />
                </Field>
              </div>

              <Button
                variant="acid"
                className="w-full"
                onClick={() => void saveCreds()}
                disabled={savingCreds || !clientId || !clientSecret}
                icon={
                  savingCreds ? <IconSpinner width={14} height={14} /> : <IconGitHub width={15} height={15} />
                }
              >
                {savingCreds ? "saving…" : "save & enable oauth"}
              </Button>

              <div className="flex items-start gap-2 rounded-md border border-ink-700 bg-ink-850/50 p-2.5 text-[11px] leading-relaxed text-mist-400">
                <IconLink width={13} height={13} className="mt-0.5 shrink-0 text-jade-300" />
                <span>
                  Prefer not to paste a secret? Register the app with{" "}
                  <strong className="text-mist-200">Device Flow</strong> checked and just a Client ID
                  — the device-flow tab needs no secret and no callback URL. Or set{" "}
                  <span className="font-mono text-mist-200">GITHUB_CLIENT_ID</span> /{" "}
                  <span className="font-mono text-mist-200">GITHUB_CLIENT_SECRET</span> as env vars.
                </span>
              </div>
            </>
          )}

          {oauth?.source === "database" && (
            <button
              onClick={() => void clearCreds()}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist-400 underline decoration-dotted hover:text-rust-400"
            >
              clear stored app credentials
            </button>
          )}
        </div>
      )}

      {/* ---------------- device flow ---------------- */}
      {tab === "device" && (
        <div className="space-y-3">
          {device ? (
            <div className="rounded-md border border-jade-500/40 bg-jade-500/5 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-jade-300">
                waiting for approval
              </div>
              <div className="mt-2 text-[12.5px] leading-relaxed text-mist-200">
                Open{" "}
                <a
                  href={device.verificationUri}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-acid-300 underline decoration-dotted"
                >
                  {device.verificationUri}
                </a>{" "}
                and enter
              </div>
              <div className="mt-2 rounded border border-ink-600 bg-ink-950 px-3 py-2 text-center font-mono text-xl tracking-[0.3em] text-acid-400">
                {device.userCode}
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-mist-400">
                <IconSpinner width={12} height={12} /> polling every {device.interval}s · expires in{" "}
                {device.expiresIn}s
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="acid"
                className="w-full"
                onClick={() => void startDeviceFlow()}
                disabled={busy || !deviceReady}
                icon={busy ? <IconSpinner width={14} height={14} /> : <IconGitHub width={15} height={15} />}
              >
                {busy ? "connecting…" : "connect with device flow"}
              </Button>
              <p className="text-[11.5px] leading-relaxed text-mist-400">
                Also OAuth, but the token arrives by polling instead of a redirect — GitHub shows you
                a code to type in. No callback URL required, so it works behind any proxy.
              </p>
            </>
          )}
        </div>
      )}

      {/* ---------------- PAT ---------------- */}
      {tab === "pat" && (
        <div className="space-y-3">
          <Field
            label="personal access token"
            hint={
              <span className="block space-y-1">
                <span className="block">
                  <strong>Classic PAT:</strong> check the <code className="text-mist-200">repo</code> scope.
                </span>
                <span className="block">
                  <strong>Fine-grained PAT:</strong> set <em>Repository permissions → Contents: Read and write</em>, and select your repository under <em>Repository access</em>.
                </span>
              </span>
            }
          >
            <TextInput
              type="password"
              value={token}
              placeholder="ghp_… or github_pat_…"
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void connectPat()}
            />
          </Field>
          <Button
            variant="acid"
            className="w-full"
            onClick={() => void connectPat()}
            disabled={busy || !token.trim()}
            icon={busy ? <IconSpinner width={14} height={14} /> : <IconGitHub width={15} height={15} />}
          >
            verify &amp; connect
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-400/5 p-2.5 font-mono text-[11px] leading-relaxed text-red-300">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="mt-3 rounded-md border border-jade-400/30 bg-jade-400/5 p-2.5 font-mono text-[11px] text-jade-300">
          {notice}
        </p>
      )}

      <p className="mt-4 border-t border-ink-700 pt-3 text-[11.5px] leading-relaxed text-mist-400">
        No account? Everything still works — arm a job in{" "}
        <span className="font-mono text-mist-200">simulate</span> mode and the scheduler will paint a
        virtual canvas on the same interval.
      </p>
    </Panel>
  );
}
