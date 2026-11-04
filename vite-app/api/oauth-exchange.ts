type Req = {
  method?: string;
  body?: unknown;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (key: string, value: string) => void;
};

/**
 * Step 2 of the GitHub OAuth web flow, server-side (Vercel Function).
 * The SPA sends the one-time `code` it received on the callback; we exchange it
 * with the client secret for a user access token. The secret never reaches the browser.
 */
export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(501).json({
      error:
        "OAuth is not configured on this deployment. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the Vercel project settings.",
    });
    return;
  }

  const body = (typeof req.body === "string" ? safeParse(req.body) : req.body ?? {}) as {
    code?: string;
    redirectUri?: string;
  };
  if (!body.code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: body.code,
      ...(body.redirectUri ? { redirect_uri: body.redirectUri } : {}),
    });
    const gh = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const json = (await gh.json().catch(() => ({}))) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!gh.ok || !json.access_token) {
      res.status(401).json({
        error: json.error_description ?? json.error ?? "token exchange failed",
      });
      return;
    }
    res.status(200).json({ accessToken: json.access_token, scope: json.scope ?? "" });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "exchange failed" });
  }
}

function safeParse(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
