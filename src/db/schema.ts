import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * A GitHub connection. Tokens are stored encrypted at rest (see lib/crypto.ts)
 * so the painter can run unattended on the scheduler.
 */
export const connections = pgTable("connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("github"),
  mode: text("mode").notNull().default("oauth"), // oauth | pat | demo
  githubId: text("github_id"),
  login: text("login").notNull(),
  avatarUrl: text("avatar_url"),
  name: text("name"),
  email: text("email"),
  scope: text("scope"),
  tokenCipher: text("token_cipher"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
});

/**
 * Runtime GitHub OAuth App credentials.
 * Lets the owner enable the real web OAuth flow without redeploying: they paste
 * the Client ID / Client Secret from their GitHub OAuth App into the studio and
 * the callback URL is derived from the request origin.
 */
export const oauthApps = pgTable("oauth_apps", {
  id: text("id").primaryKey().default("default"),
  appName: text("app_name").notNull().default("pixelpunisher.x"),
  clientId: text("client_id").notNull(),
  clientSecretCipher: text("client_secret_cipher").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/** A bitmap design: `width` weeks x `height` days, values 0..4. */
export const patterns = pgTable(
  "patterns",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id"),
    name: text("name").notNull(),
    width: integer("width").notNull().default(53),
    height: integer("height").notNull().default(7),
    cells: jsonb("cells").notNull().$type<number[]>(),
    palette: text("palette").notNull().default("moss"),
    source: text("source").notNull().default("preset"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    starred: boolean("starred").notNull().default(false),
  },
  (table) => [index("patterns_connection_idx").on(table.connectionId)],
);

/**
 * A paint job = pattern + transport + cadence.
 * The scheduler wakes up every `intervalSeconds`, paints up to `cellsPerTick`
 * cells and goes back to sleep until the whole bitmap is committed.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id"),
    patternId: text("pattern_id").notNull(),
    name: text("name").notNull().default("paint job"),
    mode: text("mode").notNull().default("simulate"), // github | simulate
    status: text("status").notNull().default("idle"), // idle|running|paused|done|error|cancelled
    repo: text("repo"), // owner/name
    branch: text("branch").notNull().default("main"),
    commitPath: text("commit_path").notNull().default(".paint/pixels.txt"),
    commitMessage: text("commit_message").notNull().default("paint: {cell}"),
    intervalSeconds: integer("interval_seconds").notNull().default(900),
    cellsPerTick: integer("cells_per_tick").notNull().default(6),
    commitsPerLevel: integer("commits_per_level").notNull().default(1),
    commitHourUtc: integer("commit_hour_utc").notNull().default(12),
    anchorDate: text("anchor_date"), // ISO date of the grid's first column (Sunday)
    cellsPainted: integer("cells_painted").notNull().default(0),
    commitsCreated: integer("commits_created").notNull().default(0),
    painted: jsonb("painted").notNull().$type<number[]>().default([]),
    lastTickAt: timestamp("last_tick_at", { mode: "date" }),
    nextTickAt: timestamp("next_tick_at", { mode: "date" }),
    lastError: text("last_error"),
    cursor: integer("cursor").notNull().default(0),
    order: text("order").notNull().default("column"), // column | row | intensity | random
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_connection_idx").on(table.connectionId),
  ],
);

/** Append-only run log so the studio can stream what the painter did. */
export const jobEvents = pgTable(
  "job_events",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    level: text("level").notNull().default("info"), // info|success|warn|error
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("job_events_job_idx").on(table.jobId)],
);

export type Connection = typeof connections.$inferSelect;
export type Pattern = typeof patterns.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobEvent = typeof jobEvents.$inferSelect;
