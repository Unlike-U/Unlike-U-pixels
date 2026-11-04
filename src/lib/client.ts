export type ConnectionView = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  mode: string;
  scope: string | null;
  createdAt?: string;
  lastUsedAt?: string | null;
};

export type PatternView = {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: number[];
  connectionId: string | null;
  source: string;
  starred: boolean;
  updatedAt?: string;
};

export type JobView = {
  id: string;
  name: string;
  mode: "github" | "simulate";
  status: "idle" | "running" | "paused" | "done" | "error" | "cancelled";
  patternId: string;
  patternName?: string | null;
  litCells?: number;
  connectionId: string | null;
  repo: string | null;
  branch: string;
  commitPath: string;
  commitMessage: string;
  intervalSeconds: number;
  cellsPerTick: number;
  commitsPerLevel: number;
  commitHourUtc: number;
  anchorDate: string | null;
  order: string;
  cellsPainted: number;
  commitsCreated: number;
  painted: number[];
  lastTickAt: string | null;
  nextTickAt: string | null;
  lastError: string | null;
};

export type EventView = {
  id: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
  createdAt: string | Date;
};

export type Progress = {
  done: number;
  percent: number;
  remaining: number;
  ticksLeft: number;
  etaMs: number;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.error === "string" ? json.error : `Request failed (${res.status})`,
      res.status,
    );
  }
  return json as T;
}

export const post = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });

export const patch = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.round(h / 24)}d`;
}

export function formatInterval(seconds: number) {
  if (seconds < 60) return `every ${seconds}s`;
  if (seconds < 3600) return `every ${Math.round(seconds / 60)}m`;
  return `every ${(seconds / 3600).toFixed(seconds % 3600 ? 1 : 0)}h`;
}

export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return "never";
  const then = new Date(date).getTime();
  const diff = Date.now() - then;
  if (diff < 5000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}
