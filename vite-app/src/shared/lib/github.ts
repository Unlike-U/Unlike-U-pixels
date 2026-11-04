/**
 * github.ts — thin GitHub transport used by the painter.
 * Everything goes through REST/GraphQL with a user token; no git binary needed.
 * Commits are created through the Git Data API so their author dates can be
 * backdated onto specific contribution-grid days.
 */

const API = "https://api.github.com";

export class GitHubError extends Error {
  status: number;
  detail?: unknown;
  method?: string;
  path?: string;
  constructor(message: string, status: number, detail?: unknown, method?: string, path?: string) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.detail = detail;
    this.method = method;
    this.path = path;
  }
}

async function gh<T>(
  path: string,
  token: string,
  init: RequestInit & { raw?: boolean } = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const method = (init.method ?? "GET").toUpperCase();
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token.trim()}`,
      "User-Agent": "pixelpunisher.x",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (init.raw) return res as unknown as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    let message =
      (json as { message?: string } | null)?.message ??
      (json as { error?: string } | null)?.error ??
      `GitHub API ${res.status}`;

    // Provide friendly diagnostics for common GitHub permission roadblocks
    if (
      res.status === 403 &&
      typeof message === "string" &&
      message.toLowerCase().includes("resource not accessible")
    ) {
      if (path.includes("/user/repos")) {
        message =
          `Cannot auto-create repository via API ("Resource not accessible by integration"). ` +
          `Fine-grained PATs and GitHub Apps cannot create user repositories via API. ` +
          `Please create the repository manually at https://github.com/new and select it in the studio.`;
      } else if (path.includes("/git/") || path.includes("/contents/") || path.includes("/refs")) {
        const repoName = path.split("/repos/")[1]?.split("/git/")[0] ?? "the repository";
        message =
          `Cannot write to repository ${repoName} ("Resource not accessible by integration"). ` +
          `Your token lacks write access. ` +
          `If using a Fine-grained PAT: edit token at https://github.com/settings/tokens, ensure "Repository permissions → Contents: Read and write" is granted and ${repoName} is selected under "Repository access". ` +
          `If using an OAuth App or Classic PAT: ensure the "repo" scope was granted.`;
      }
    }

    throw new GitHubError(message, res.status, json, method, path);
  }
  return json as T;
}

/* ---------------- OAuth device flow (no client secret required) ---------------- */

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export const DEVICE_SCOPES = "repo read:user user:email";

/** Device flow only needs a client id — no secret, no redirect URI. */
export async function startDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  const form = new URLSearchParams({
    client_id: clientId,
    scope: DEVICE_SCOPES,
  });
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as DeviceCodeResponse & { error?: string };
  if (!res.ok || json.error) {
    throw new GitHubError(json.error ?? "device flow failed", res.status, json);
  }
  return json;
}

export type DevicePollResult =
  | { status: "pending" }
  | { status: "slow_down"; interval: number }
  | { status: "error"; error: string }
  | { status: "authorized"; accessToken: string; scope: string };

export async function pollDeviceFlow(
  deviceCode: string,
  clientId: string,
): Promise<DevicePollResult> {
  const form = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    interval?: number;
  };
  if (json.access_token) {
    return { status: "authorized", accessToken: json.access_token, scope: json.scope ?? "" };
  }
  if (json.error === "authorization_pending") return { status: "pending" };
  if (json.error === "slow_down") return { status: "slow_down", interval: json.interval ?? 5 };
  return { status: "error", error: json.error ?? "unknown" };
}

/* ---------------- profile / repos ---------------- */

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
};

export const getUser = (token: string) => gh<GitHubUser>("/user", token);

export type RepoSummary = {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  fork: boolean;
  pushed_at: string | null;
  owner: { login: string };
};

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const repos: RepoSummary[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await gh<RepoSummary[]>(
      `/user/repos?per_page=100&sort=pushed&affiliation=owner&page=${page}`,
      token,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

export async function ensureRepo(
  token: string,
  name: string,
  isPrivate: boolean,
): Promise<RepoSummary> {
  const me = await getUser(token);
  let owner = me.login;
  let repoName = (name || "").trim();

  // Handle "owner/repo" format if provided
  if (repoName.includes("/")) {
    const parts = repoName.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      owner = parts[0];
      repoName = parts.slice(1).join("/");
    } else if (parts.length === 1) {
      repoName = parts[0];
    }
  }

  if (!repoName) {
    repoName = `${me.login.toLowerCase()}-pixels`;
  }

  // 1. Check if the repository ALREADY exists FIRST!
  // This avoids calling POST /user/repos unnecessarily, which saves API quota,
  // prevents race conditions, and works with tokens (like Fine-grained PATs)
  // that do not have permission to create new repositories via API.
  try {
    const existing = await gh<RepoSummary>(`/repos/${owner}/${repoName}`, token);
    if (existing && existing.full_name) {
      return existing;
    }
  } catch (err) {
    if (err instanceof GitHubError && err.status === 403) {
      throw new GitHubError(
        `Cannot access repository "${owner}/${repoName}" (${err.message}). ` +
        `Please check that your token has read/write permissions for this repository.`,
        403,
        err.detail,
        "GET",
        `/repos/${owner}/${repoName}`,
      );
    }
    // 404 means the repository doesn't exist yet; proceed to creation.
    if (!(err instanceof GitHubError && err.status === 404)) {
      throw err;
    }
  }

  // 2. The repo does not exist. Try to create it via API.
  try {
    return await gh<RepoSummary>("/user/repos", token, {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        private: isPrivate,
        description: "Bitmap painted by pixelpunisher.x — backdated commits as pixels.",
        auto_init: false,
      }),
    });
  } catch (err) {
    if (err instanceof GitHubError) {
      // 422: repository already exists (race condition)
      if (err.status === 422) {
        return await gh<RepoSummary>(`/repos/${owner}/${repoName}`, token);
      }
      // 403: "Resource not accessible by integration" (Fine-grained PAT / GitHub App)
      if (err.status === 403) {
        throw new GitHubError(
          `Cannot auto-create repository "${owner}/${repoName}" via API (${err.message}). ` +
          `Fine-grained PATs and GitHub Apps cannot create personal repositories via API. ` +
          `Please create an empty repository named "${repoName}" manually at https://github.com/new ` +
          `and ensure your token has "Contents: Read and write" access to it.`,
          403,
          err.detail,
          "POST",
          "/user/repos",
        );
      }
    }
    throw err;
  }
}

export async function resolveCommitEmail(token: string, login: string, id?: number) {
  try {
    const emails = await gh<Array<{ email: string; primary: boolean; verified: boolean }>>(
      "/user/emails",
      token,
    );
    if (Array.isArray(emails)) {
      const best =
        emails.find((e) => e.primary && e.verified) ??
        emails.find((e) => e.verified) ??
        emails[0];
      if (best?.email) return best.email;
    }
  } catch {
    /* scope may be missing or token cannot access emails — fall through to noreply */
  }
  return id ? `${id}+${login}@users.noreply.github.com` : `${login}@users.noreply.github.com`;
}

/* ---------------- git data painting ---------------- */

type RefResponse = { object: { sha: string; type: string } };

async function tryGetRef(token: string, repo: string, branch: string) {
  try {
    return await gh<RefResponse>(`/repos/${repo}/git/ref/heads/${branch}`, token);
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  }
}

async function createBlob(token: string, repo: string, content: string) {
  const res = await gh<{ sha: string }>(`/repos/${repo}/git/blobs`, token, {
    method: "POST",
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  return res.sha;
}

type CommitInput = {
  message: string;
  tree: string;
  parents: string[];
  date: string; // ISO 8601
  authorName: string;
  authorEmail: string;
};

async function createCommit(token: string, repo: string, input: CommitInput) {
  const res = await gh<{ sha: string }>(`/repos/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      tree: input.tree,
      parents: input.parents,
      author: { name: input.authorName, email: input.authorEmail, date: input.date },
      committer: { name: input.authorName, email: input.authorEmail, date: input.date },
    }),
  });
  return res.sha;
}

async function createTree(token: string, repo: string, baseTree: string, path: string, blob: string) {
  const res = await gh<{ sha: string }>(`/repos/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      // an empty repository has no tree to base off
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: [{ path, mode: "100644", type: "blob", sha: blob }],
    }),
  });
  return res.sha;
}

/** Creates the branch with a seed commit when the repo is still empty. */
export async function ensureBranch(token: string, repo: string, branch: string, path: string) {
  const cleanBranch = branch.replace(/^refs\/heads\//, "").replace(/^\/+/, "").trim() || "main";
  const ref = await tryGetRef(token, repo, cleanBranch);
  if (ref) return ref.object.sha;

  const now = new Date().toISOString();
  const blob = await createBlob(token, repo, `# pixelpunisher.x\n\nseeded ${now}\n`);
  const tree = await createTree(token, repo, "", path, blob);
  const commit = await createCommit(token, repo, {
    message: "chore: seed canvas",
    tree,
    parents: [],
    date: now,
    authorName: "pixelpunisher.x",
    authorEmail: "pixelpunisher@users.noreply.github.com",
  });
  await gh(`/repos/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${cleanBranch}`, sha: commit }),
  });
  return commit;
}

export type PaintCommitRequest = {
  message: string;
  date: string;
};

/**
 * Appends `requests.length` backdated commits to `branch` in one ref update.
 * Returns the number of commits created and the new head sha.
 */
export async function paintCommits(
  token: string,
  opts: {
    repo: string;
    branch: string;
    path: string;
    authorName: string;
    authorEmail: string;
    requests: PaintCommitRequest[];
    content: string;
  },
): Promise<{ commits: number; head: string }> {
  const { repo, branch, path, requests } = opts;
  if (!requests.length) return { commits: 0, head: "" };

  const cleanBranch = branch.replace(/^refs\/heads\//, "").replace(/^\/+/, "").trim() || "main";
  let head = await ensureBranch(token, repo, cleanBranch, path);
  const blob = await createBlob(token, repo, opts.content);

  for (const req of requests) {
    const tree = await createTree(token, repo, head, path, blob);
    head = await createCommit(token, repo, {
      message: req.message,
      tree,
      parents: [head],
      date: req.date,
      authorName: opts.authorName,
      authorEmail: opts.authorEmail,
    });
  }

  await gh(`/repos/${repo}/git/refs/heads/${cleanBranch}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: head, force: true }),
  });

  return { commits: requests.length, head };
}

/* ---------------- contribution calendar ---------------- */

export type ContributionDay = { level: number; count: number; date: string };
export type ContributionGrid = {
  login: string;
  total: number;
  weeks: ContributionDay[][];
};

const CALENDAR_QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { firstDay contributionDays { contributionCount contributionLevel date } }
      }
    }
  }
}`;

const LEVEL_MAP: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

export async function fetchContributions(
  token: string,
  login: string,
): Promise<ContributionGrid> {
  const res = await gh<{
    data?: {
      user?: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: Array<{
              firstDay: string;
              contributionDays: Array<{
                contributionCount: number;
                contributionLevel: string;
                date: string;
              }>;
            }>;
          };
        };
      } | null;
    };
    errors?: Array<{ message: string }>;
  }>("/graphql", token, {
    method: "POST",
    body: JSON.stringify({ query: CALENDAR_QUERY, variables: { login } }),
  });

  if (res.errors?.length) throw new GitHubError(res.errors[0].message, 400, res.errors);
  const user = res.data?.user;
  if (!user) throw new GitHubError(`No contribution data for ${login}`, 404);

  const cal = user.contributionsCollection.contributionCalendar;
  return {
    login,
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) =>
      w.contributionDays.map((d) => ({
        level: LEVEL_MAP[d.contributionLevel] ?? 0,
        count: d.contributionCount,
        date: d.date,
      })),
    ),
  };
}

export async function rateLimit(token: string) {
  const res = await gh<{ resources: { core: { remaining: number; limit: number; reset: number } } }>(
    "/rate_limit",
    token,
  );
  return res.resources.core;
}
