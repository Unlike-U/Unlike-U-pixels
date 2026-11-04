import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthApps } from "@/db/schema";
import { decrypt, encrypt } from "./crypto";

export const OAUTH_SCOPES = "repo read:user user:email";
export const STATE_COOKIE = "pp_oauth_state";
export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

export type OAuthStatus = {
  /** client id available at all (env or database) */
  clientId: string | null;
  /** where the credentials came from */
  source: "env" | "database" | "none";
  /** full web flow (client id + secret) — enables the redirect dance */
  webFlowReady: boolean;
  /** device flow only needs a client id */
  deviceFlowReady: boolean;
};

const signingSecret = () =>
  process.env.TOKEN_SECRET ?? process.env.DATABASE_URL ?? "pixel-painter-dev";

export async function readOAuthStatus(): Promise<OAuthStatus> {
  const envId = process.env.GITHUB_CLIENT_ID;
  const envSecret = process.env.GITHUB_CLIENT_SECRET;
  if (envId && envSecret) {
    return {
      clientId: envId,
      source: "env",
      webFlowReady: true,
      deviceFlowReady: true,
    };
  }
  try {
    const [row] = await db
      .select()
      .from(oauthApps)
      .where(eq(oauthApps.id, "default"))
      .limit(1);
    if (row) {
      const secret = decrypt(row.clientSecretCipher);
      return {
        clientId: row.clientId,
        source: "database",
        webFlowReady: Boolean(secret),
        deviceFlowReady: true,
      };
    }
  } catch {
    /* table may not exist yet during first boot */
  }
  if (envId) {
    return { clientId: envId, source: "env", webFlowReady: false, deviceFlowReady: true };
  }
  return { clientId: null, source: "none", webFlowReady: false, deviceFlowReady: false };
}

/** Full credentials, only when the redirect flow is possible. */
export async function readOAuthCredentials() {
  const status = await readOAuthStatus();
  if (!status.clientId) return null;
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  const [row] = await db.select().from(oauthApps).where(eq(oauthApps.id, "default")).limit(1);
  const secret = row ? decrypt(row.clientSecretCipher) : null;
  if (!secret) return null;
  return { clientId: row!.clientId, clientSecret: secret };
}

export async function saveOAuthCredentials(clientId: string, clientSecret: string, appName?: string) {
  const row = {
    id: "default",
    appName: appName?.trim() || "pixelpunisher.x",
    clientId: clientId.trim(),
    clientSecretCipher: encrypt(clientSecret.trim()),
    updatedAt: new Date(),
  };
  await db
    .insert(oauthApps)
    .values(row)
    .onConflictDoUpdate({
      target: oauthApps.id,
      set: {
        appName: row.appName,
        clientId: row.clientId,
        clientSecretCipher: row.clientSecretCipher,
        updatedAt: row.updatedAt,
      },
    });
}

export async function clearOAuthCredentials() {
  await db.delete(oauthApps).where(eq(oauthApps.id, "default"));
}

/* ---------------- origin + callback ---------------- */

/** Best-effort public origin of this deployment, from proxy headers. */
export function originFrom(req: Request) {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = req.headers;
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? "http";
  const host = h.get("x-forwarded-host")?.split(",")[0] ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host.trim()}`;
}

export const callbackUrlFor = (origin: string) => `${origin}/api/auth/github/callback`;

/* ---------------- CSRF state ---------------- */

export function createState() {
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", signingSecret()).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export function verifyState(state: string | null | undefined, cookieState: string | null | undefined) {
  if (!state || !cookieState) return false;
  const [nonceA, sigA] = String(state).split(".");
  const [nonceB, sigB] = String(cookieState).split(".");
  if (!nonceA || !sigA || !nonceB || !sigB) return false;
  if (nonceA !== nonceB) return false;
  const a = Buffer.from(sigA, "hex");
  const b = createHmac("sha256", signingSecret()).update(nonceA).digest();
  return a.length === b.length && timingSafeEqual(a, b) && sigA === sigB;
}

/* ---------------- token exchange ---------------- */

export type ExchangeResult =
  | { ok: true; accessToken: string; scope: string; tokenType: string }
  | { ok: false; error: string };

/** Standard GitHub OAuth web-application flow, step 2. */
export async function exchangeCodeForToken(opts: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<ExchangeResult> {
  const form = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    return {
      ok: false,
      error: json.error_description ?? json.error ?? `token exchange failed (${res.status})`,
    };
  }
  return {
    ok: true,
    accessToken: json.access_token,
    scope: json.scope ?? OAUTH_SCOPES,
    tokenType: json.token_type ?? "bearer",
  };
}

export function authorizeUrl(opts: { clientId: string; redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: OAUTH_SCOPES,
    state: opts.state,
    allow_signup: "true",
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}
