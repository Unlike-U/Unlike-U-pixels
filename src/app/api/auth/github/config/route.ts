import { NextResponse } from "next/server";
import {
  OAUTH_SCOPES,
  callbackUrlFor,
  clearOAuthCredentials,
  originFrom,
  readOAuthStatus,
  saveOAuthCredentials,
} from "@/lib/oauth";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** What the UI needs to know: is OAuth wired up, and what callback URL to register. */
export async function GET(req: Request) {
  const origin = originFrom(req);
  const status = await readOAuthStatus();
  return ok({
    ...status,
    scopes: OAUTH_SCOPES,
    origin,
    callbackUrl: callbackUrlFor(origin),
    envConfigured: status.source === "env",
  });
}

/** Save the GitHub OAuth App credentials so the redirect flow works. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    clientId?: string;
    clientSecret?: string;
    appName?: string;
  };
  const clientId = (body.clientId ?? "").trim();
  const clientSecret = (body.clientSecret ?? "").trim();
  if (!clientId || !clientSecret) return fail("clientId and clientSecret are both required");

  // GitHub client ids are either 20 hex chars or an "Iv1."/"Iv2."-prefixed string.
  if (!/^(Iv[12]\.)?[A-Fa-f0-9]{16,}$/.test(clientId)) {
    return fail(
      "That doesn't look like a GitHub Client ID — it's either 20 hex characters or an Iv1./Iv2.-prefixed value.",
    );
  }

  try {
    await saveOAuthCredentials(clientId, clientSecret, body.appName);
    const status = await readOAuthStatus();
    return ok({
      ...status,
      scopes: OAUTH_SCOPES,
      origin: originFrom(req),
      callbackUrl: callbackUrlFor(originFrom(req)),
    });
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export async function DELETE() {
  try {
    await clearOAuthCredentials();
    const status = await readOAuthStatus();
    return ok(status);
  } catch (err) {
    return fail(errorMessage(err), 500);
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
