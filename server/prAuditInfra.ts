import type { FileTreeItem, InsertFinding } from "@shared/schema";
import type { Octokit } from "@octokit/rest";

type GitHubPullRef = { owner: string; repo: string; pullNumber: number };
type GitHubIssueRef = { owner: string; repo: string; issueNumber: number };

type PullRequestContext = {
  pull: { title: string; body: string; diffUrl: string; htmlUrl: string };
  changedFiles: Array<{ filename: string; patch: string | null; status: string }>;
  linkedIssue?: { title: string; body: string; htmlUrl: string; issueNumber: number };
};

type RetrievedDoc = { path: string; score: number; snippet: string };

type DriftAssessment = {
  driftDetected: boolean;
  confidence: "low" | "medium" | "high";
  rationale: string;
  missingGoals: string[];
};

type RemediationProposal = {
  prTitle: string;
  prBody: string;
  patch: string;
};

type ScaFinding = {
  packageName: string;
  currentVersion: string;
  latestVersion: string | null;
  risk: "low" | "medium" | "high";
  reason: string;
};

const DOC_HINTS = ["schema", "openapi", "readme", "docs/", "adr", "design", "architecture"];

export function parseGitHubPullRef(input: string | null | undefined): GitHubPullRef | null {
  if (!input) return null;
  const match = input.match(/github\.com\/([^\s/]+)\/([^\s/]+)\/pull\/(\d+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, ""), pullNumber: Number(match[3]) };
}

export function parseGitHubIssueRef(input: string | null | undefined): GitHubIssueRef | null {
  if (!input) return null;
  const match = input.match(/github\.com\/([^\s/]+)\/([^\s/]+)\/issues\/(\d+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, ""), issueNumber: Number(match[3]) };
}

function tokenizePath(path: string): string[] {
  return path
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function rankContextFiles(tree: FileTreeItem[], changedFiles: string[]): string[] {
  const changedTokens = new Set(changedFiles.flatMap((file) => tokenizePath(file)));
  const docs = tree.filter((item) => {
    if (item.type !== "file") return false;
    const lower = item.path.toLowerCase();
    return DOC_HINTS.some((hint) => lower.includes(hint)) || lower.endsWith(".md") || lower.endsWith(".sql");
  });

  return docs
    .map((doc) => {
      const tokens = tokenizePath(doc.path);
      const overlap = tokens.filter((token) => changedTokens.has(token)).length;
      const docBoost = doc.path.toLowerCase().includes("schema") ? 2 : 0;
      return { path: doc.path, score: overlap + docBoost };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 6)
    .map((item) => item.path);
}

async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if (!("content" in data) || data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

export async function fetchPullRequestContext(
  octokit: Octokit,
  ref: GitHubPullRef,
  explicitIssueRef?: GitHubIssueRef | null,
): Promise<PullRequestContext | null> {
  try {
    const { data: pull } = await octokit.pulls.get({ owner: ref.owner, repo: ref.repo, pull_number: ref.pullNumber });
    const files = await octokit.paginate(octokit.pulls.listFiles, {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.pullNumber,
      per_page: 100,
    });

    let linkedIssue: PullRequestContext["linkedIssue"];
    const body = pull.body || "";
    const closingRef = body.match(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/i);
    const issueRef = explicitIssueRef || (closingRef ? { owner: ref.owner, repo: ref.repo, issueNumber: Number(closingRef[1]) } : null);

    if (issueRef) {
      try {
        const { data: issue } = await octokit.issues.get({ owner: issueRef.owner, repo: issueRef.repo, issue_number: issueRef.issueNumber });
        linkedIssue = {
          title: issue.title,
          body: issue.body || "",
          htmlUrl: issue.html_url,
          issueNumber: issue.number,
        };
      } catch {
        linkedIssue = undefined;
      }
    }

    return {
      pull: {
        title: pull.title,
        body,
        diffUrl: pull.diff_url || "",
        htmlUrl: pull.html_url,
      },
      changedFiles: files.map((f) => ({ filename: f.filename, patch: f.patch || null, status: f.status })),
      linkedIssue,
    };
  } catch {
    return null;
  }
}

function normalizeVersion(v: string): string {
  return v.replace(/^[~^><=\s]+/, "").trim();
}

function major(v: string): number {
  const n = Number.parseInt(normalizeVersion(v).split(".")[0], 10);
  return Number.isFinite(n) ? n : 0;
}

export function analyzeDependencyVersions(deps: Record<string, string>, latest: Record<string, string>): ScaFinding[] {
  return Object.entries(deps)
    .map(([name, currentRaw]) => {
      const current = normalizeVersion(currentRaw);
      const latestVersion = latest[name] ? normalizeVersion(latest[name]) : null;
      if (!latestVersion) {
        return {
          packageName: name,
          currentVersion: current,
          latestVersion: null,
          risk: "medium" as const,
          reason: "Package not found in registry lookup; verify source and pinning strategy.",
        };
      }

      const majorDelta = major(latestVersion) - major(current);
      const risk: ScaFinding["risk"] = majorDelta >= 2 ? "high" : majorDelta === 1 ? "medium" : "low";
      return {
        packageName: name,
        currentVersion: current,
        latestVersion,
        risk,
        reason:
          majorDelta > 0
            ? `Behind latest by ${majorDelta} major version(s); review for security and compatibility updates.`
            : "Version is aligned with current major release.",
      };
    })
    .filter((item) => item.risk !== "low")
    .slice(0, 12);
}

export async function runRegistryLookup(deps: Record<string, string>): Promise<ScaFinding[]> {
  const entries = Object.entries(deps).slice(0, 30);
  const latestMap: Record<string, string> = {};

  await Promise.all(
    entries.map(async ([name]) => {
      try {
        const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace("%40", "@")}\/latest`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: string };
        if (data.version) latestMap[name] = data.version;
      } catch {
        // ignore and continue best-effort
      }
    }),
  );

  return analyzeDependencyVersions(Object.fromEntries(entries), latestMap);
}

export async function retrieveContextDocuments(
  octokit: Octokit,
  owner: string,
  repo: string,
  tree: FileTreeItem[],
  changedFiles: string[],
): Promise<RetrievedDoc[]> {
  const candidates = rankContextFiles(tree, changedFiles);
  const docs: RetrievedDoc[] = [];
  for (const path of candidates) {
    const content = await getFileContent(octokit, owner, repo, path);
    if (!content) continue;
    docs.push({ path, score: 1, snippet: content.split("\n").slice(0, 30).join("\n") });
  }
  return docs;
}

async function callLlm(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}

function extractJson<T>(value: string | null): T | null {
  if (!value) return null;
  const fenced = value.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : value;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function assessDriftWithLlm(input: {
  apiKey: string;
  issueTitle: string;
  issueBody: string;
  prTitle: string;
  prDiff: string;
  docs: RetrievedDoc[];
}): Promise<DriftAssessment | null> {
  const prompt = [
    "You are auditing whether a pull request matches the business intent of a GitHub issue.",
    "Return strict JSON with keys: driftDetected (boolean), confidence (low|medium|high), rationale (string), missingGoals (string[]).",
    `Issue title: ${input.issueTitle}`,
    `Issue body:\n${input.issueBody.slice(0, 3000)}`,
    `PR title: ${input.prTitle}`,
    `PR diff:\n${input.prDiff.slice(0, 9000)}`,
    `Context docs:\n${input.docs.map((d) => `# ${d.path}\n${d.snippet.slice(0, 800)}`).join("\n\n")}`,
  ].join("\n\n");

  return extractJson<DriftAssessment>(await callLlm(input.apiKey, prompt));
}

export async function proposeRemediationPatch(input: {
  apiKey: string;
  finding: Pick<InsertFinding, "title" | "description" | "filePath" | "fixSteps" | "codeSnippet">;
  prContext: PullRequestContext;
  docs: RetrievedDoc[];
}): Promise<RemediationProposal | null> {
  const prompt = [
    "You are a remediation engine. Produce a minimal PR proposal that fixes the finding.",
    "Return strict JSON with keys: prTitle, prBody, patch. patch must be a unified diff.",
    `Finding: ${input.finding.title}`,
    `Description: ${input.finding.description}`,
    `File: ${input.finding.filePath || "unknown"}`,
    `Suggested fix: ${input.finding.fixSteps}`,
    `Code context:\n${input.finding.codeSnippet || "not provided"}`,
    `PR context:\n${input.prContext.pull.title}\n${input.prContext.pull.body}`,
    `Docs:\n${input.docs.map((d) => `# ${d.path}\n${d.snippet.slice(0, 400)}`).join("\n\n")}`,
  ].join("\n\n");

  return extractJson<RemediationProposal>(await callLlm(input.apiKey, prompt));
}
