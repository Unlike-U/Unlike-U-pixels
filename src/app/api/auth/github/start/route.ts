import { NextResponse } from "next/server";
import {
  STATE_COOKIE,
  authorizeUrl,
  callbackUrlFor,
  originFrom,
  readOAuthCredentials,
} from "@/lib/oauth";
import { fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Step 1 of the OAuth web flow: bounce the browser to GitHub's consent screen
 * with a signed `state` value that we verify on the way back.
 */
export async function GET(req: Request) {
  const creds = await readOAuthCredentials();
  if (!creds) {
    return fail(
      "OAuth is not configured. Save a GitHub OAuth App Client ID and Client Secret first.",
      400,
    );
  }

  const origin = originFrom(req);
  const state = (await import("@/lib/oauth")).createState();
  const url = authorizeUrl({
    clientId: creds.clientId,
    redirectUri: callbackUrlFor(origin),
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  });
  return res;
}
