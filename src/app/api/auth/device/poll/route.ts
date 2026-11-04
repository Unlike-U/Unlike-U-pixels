import { upsertGitHubConnection } from "@/lib/connections";
import { readOAuthStatus } from "@/lib/oauth";
import { pollDeviceFlow } from "@/lib/github";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Device-flow poller: GitHub's other OAuth grant, no redirect URI required. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { deviceCode?: string; clientId?: string };
  if (!body.deviceCode) return fail("deviceCode is required");

  const status = await readOAuthStatus();
  const clientId = body.clientId?.trim() || status.clientId;
  if (!clientId) return fail("No OAuth App is configured for the device flow.", 501);

  try {
    const result = await pollDeviceFlow(body.deviceCode, clientId);
    if (result.status !== "authorized") {
      return ok({
        status: result.status,
        ...(result.status === "slow_down" ? { interval: result.interval } : {}),
        ...(result.status === "error" ? { error: result.error } : {}),
      });
    }

    const connection = await upsertGitHubConnection(result.accessToken, "oauth", result.scope);
    return ok({ status: "authorized", connection });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
