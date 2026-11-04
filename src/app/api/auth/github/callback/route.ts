import { NextResponse } from "next/server";
import { STATE_COOKIE, callbackUrlFor, exchangeCodeForToken, originFrom, readOAuthCredentials, verifyState } from "@/lib/oauth";
import { upsertGitHubConnection } from "@/lib/connections";
import { errorMessage } from "@/lib/api";

export const dynamic = "force-dynamic";

function back(origin: string, params: Record<string, string>) {
  const url = new URL("/studio", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url.toString());
  res.cookies.delete(STATE_COOKIE);
  return res;
}

/**
 * Step 2 of the OAuth web flow: GitHub sends the browser back here with a
 * one-time `code`. We verify state, exchange it for a user token, store the
 * connection, then hand the browser back to the studio.
 */
export async function GET(req: Request) {
  const origin = originFrom(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (providerError) return back(origin, { oauth_error: providerError });
  if (!code) return back(origin, { oauth_error: "GitHub did not return an authorization code." });

  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!verifyState(state, cookieState ? decodeURIComponent(cookieState) : null)) {
    return back(origin, {
      oauth_error:
        "State mismatch — the callback could not be verified. Start the authorization again.",
    });
  }

  const creds = await readOAuthCredentials();
  if (!creds) return back(origin, { oauth_error: "OAuth credentials disappeared mid-flow." });

  try {
    const exchange = await exchangeCodeForToken({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      code,
      redirectUri: callbackUrlFor(origin),
    });
    if (!exchange.ok) return back(origin, { oauth_error: exchange.error });

    const connection = await upsertGitHubConnection(
      exchange.accessToken,
      "oauth",
      exchange.scope,
    );

    return back(origin, {
      connected: connection.login,
      connection_id: connection.id,
      scope: exchange.scope,
    });
  } catch (err) {
    return back(origin, { oauth_error: errorMessage(err) });
  }
}
