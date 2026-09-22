// Ingestion layer: pulls raw, noisy context (commits, PRs, issues) for a
// repo from the GitHub REST API and shapes it into a consistent structure.
// This is deliberately dumb — no summarizing, no filtering for relevance.
// The draft generator (phase 2) is where that judgment happens.

const GITHUB_API = "https://api.github.com";

export interface RepoCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface RepoPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  updatedAt: string;
  url: string;
}

export interface RepoIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  updatedAt: string;
  url: string;
}

export interface RepoContext {
  owner: string;
  repo: string;
  commits: RepoCommit[];
  pullRequests: RepoPullRequest[];
  issues: RepoIssue[];
  fetchedAt: string;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "context-draft-engine",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status} for ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Pulls the last `limit` commits, PRs, and issues for a public repo.
 * No auth required for public repos, but a GITHUB_TOKEN env var raises
 * the rate limit from 60/hr to 5000/hr — worth setting for real use.
 */
export async function fetchRepoContext(
  owner: string,
  repo: string,
  limit = 10
): Promise<RepoContext> {
  const [commitsRaw, pullsRaw, issuesRaw] = await Promise.all([
    githubGet<any[]>(`/repos/${owner}/${repo}/commits?per_page=${limit}`),
    githubGet<any[]>(
      `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=${limit}`
    ),
    // The issues endpoint also returns PRs mixed in — filtered out below.
    githubGet<any[]>(
      `/repos/${owner}/${repo}/issues?state=all&sort=updated&direction=desc&per_page=${limit * 2}`
    ),
  ]);

  const commits: RepoCommit[] = commitsRaw.map((c) => ({
    sha: c.sha,
    message: c.commit?.message ?? "",
    author: c.commit?.author?.name ?? "unknown",
    date: c.commit?.author?.date ?? "",
    url: c.html_url,
  }));

  const pullRequests: RepoPullRequest[] = pullsRaw.map((p) => ({
    number: p.number,
    title: p.title,
    body: p.body,
    state: p.state,
    updatedAt: p.updated_at,
    url: p.html_url,
  }));

  const issues: RepoIssue[] = issuesRaw
    .filter((i) => !i.pull_request)
    .slice(0, limit)
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body,
      state: i.state,
      updatedAt: i.updated_at,
      url: i.html_url,
    }));

  return {
    owner,
    repo,
    commits,
    pullRequests,
    issues,
    fetchedAt: new Date().toISOString(),
  };
}
