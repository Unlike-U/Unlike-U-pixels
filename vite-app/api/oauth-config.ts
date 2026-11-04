type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (key: string, value: string) => void;
};

/**
 * Tells the SPA whether the OAuth web flow is available.
 * Only the client id is exposed — it is public by design. The secret never leaves the server.
 */
export default function handler(_req: unknown, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  const clientId = process.env.GITHUB_CLIENT_ID ?? null;
  res.status(200).json({
    app: "pixelpunisher.x",
    clientId,
    webFlowReady: Boolean(clientId && process.env.GITHUB_CLIENT_SECRET),
    scopes: "repo read:user user:email",
  });
}
