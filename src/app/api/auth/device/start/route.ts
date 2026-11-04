import { readOAuthStatus } from "@/lib/oauth";
import { startDeviceFlow } from "@/lib/github";
import { errorMessage, fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Is the device flow (client-id-only OAuth grant) available? */
export async function GET() {
  const status = await readOAuthStatus();
  return ok({
    configured: status.deviceFlowReady,
    webFlowReady: status.webFlowReady,
    source: status.source,
  });
}

export async function POST() {
  const status = await readOAuthStatus();
  if (!status.clientId) {
    return fail(
      "No GitHub OAuth App is configured yet. Save a Client ID (and Client Secret for the redirect flow) in the Connect panel.",
      501,
    );
  }
  try {
    const res = await startDeviceFlow(status.clientId);
    return ok({
      deviceCode: res.device_code,
      userCode: res.user_code,
      verificationUri: res.verification_uri,
      expiresIn: res.expires_in,
      interval: res.interval,
    });
  } catch (err) {
    return fail(errorMessage(err), 502);
  }
}
