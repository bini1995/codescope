import { Octokit } from "@octokit/rest";
import { SCAN_LIMITS } from "@shared/scan-limits";

const GITLEAKS_PATTERNS: Array<{ name: string; pattern: RegExp; severity: "critical" | "high" }> = [
  { name: "Stripe Secret Key", pattern: /(?:sk_live_|sk_test_)[a-zA-Z0-9]{20,}/g, severity: "critical" },
  { name: "AWS Access Key", pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, severity: "critical" },
  { name: "GitHub PAT", pattern: /ghp_[a-zA-Z0-9]{36}/g, severity: "critical" },
  { name: "Slack Token", pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/g, severity: "high" },
  { name: "Private Key", pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, severity: "critical" },
];

const SEMGREP_PATTERNS: Array<{ name: string; pattern: RegExp; severity: "high" | "medium" }> = [
  { name: "Potential SQL injection string interpolation", pattern: /(?:query|execute|exec)\s*\(\s*[`'"].*\$\{/g, severity: "high" },
  { name: "Dangerous eval usage", pattern: /\beval\s*\(/g, severity: "high" },
  { name: "Unsafe open CORS", pattern: /cors\s*\(\s*\{?\s*origin\s*:\s*(?:true|['"]\*['"])/g, severity: "medium" },
  { name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/g, severity: "medium" },
];

export type PreviewScanResult = {
  fullName: string;
  defaultBranch: string;
  filesScanned: number;
  treeEntries: number;
  repoSizeKb: number;
  semgrepMatches: Array<{ filePath: string; rule: string; severity: string; count: number }>;
  gitleaksMatches: Array<{ filePath: string; detector: string; severity: string; count: number }>;
};

export type FreeRiskScanResult = {
  fullName: string;
  defaultBranch: string;
  filesScanned: number;
  scanDurationMs: number;
  criticalFinding: {
    title: string;
    severity: "critical" | "high";
    filePath: string;
    evidenceCount: number;
  };
};

export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const normalized = url.trim().replace(/\.git$/, "");
  const match = normalized.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function decodeGitHubContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf8");
}

function rankSeverity(severity: string): number {
  if (severity === "critical") return 0;
  if (severity === "high") return 1;
  if (severity === "medium") return 2;
  return 3;
}

function buildSingleCriticalFinding(result: PreviewScanResult): FreeRiskScanResult["criticalFinding"] | null {
  const prioritized = [
    ...result.gitleaksMatches.map((match) => ({
      title: match.detector,
      severity: match.severity as "critical" | "high",
      filePath: match.filePath,
      evidenceCount: match.count,
    })),
    ...result.semgrepMatches
      .filter((match) => match.severity === "critical" || match.severity === "high")
      .map((match) => ({
        title: match.rule,
        severity: match.severity as "critical" | "high",
        filePath: match.filePath,
        evidenceCount: match.count,
      })),
  ].sort((a, b) => rankSeverity(a.severity) - rankSeverity(b.severity) || b.evidenceCount - a.evidenceCount);

  return prioritized[0] ?? null;
}

export async function runPreviewScan(input: {
  repoUrl: string;
  githubToken?: string;
}): Promise<PreviewScanResult> {
  const parsed = parseGitHubRepo(input.repoUrl);
  if (!parsed) {
    throw new Error("Provide a valid GitHub repository URL");
  }

  const octokit = input.githubToken ? new Octokit({ auth: input.githubToken }) : new Octokit();
  const { owner, repo } = parsed;

  const { data: repoData } = await octokit.repos.get({ owner, repo });

  if (repoData.size > SCAN_LIMITS.maxRepoSizeKb) {
    throw new Error(`Repository exceeds size limit (${SCAN_LIMITS.maxRepoSizeKb} KB / 20 MB)`);
  }

  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: repoData.default_branch,
    recursive: "true",
  });

  const treeEntries = treeData.tree.filter((entry) => entry.type === "blob" || entry.type === "tree");
  const files = treeEntries.filter((entry) => entry.type === "blob" && entry.path).map((entry) => ({
    path: entry.path as string,
    size: entry.size ?? 0,
  }));

  if (files.length > SCAN_LIMITS.maxFilesToScan) {
    throw new Error(`Repository exceeds file limit (${files.length} files > ${SCAN_LIMITS.maxFilesToScan})`);
  }

  const scannableFiles = files
    .filter((file) => file.size > 0 && file.size <= SCAN_LIMITS.maxFileSizeBytes)
    .slice(0, SCAN_LIMITS.maxPatternScanFiles);

  const semgrepMatches: PreviewScanResult["semgrepMatches"] = [];
  const gitleaksMatches: PreviewScanResult["gitleaksMatches"] = [];

  for (const file of scannableFiles) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
      if (!("content" in data) || data.encoding !== "base64") continue;
      const content = decodeGitHubContent(data.content);

      for (const detector of GITLEAKS_PATTERNS) {
        const count = [...content.matchAll(detector.pattern)].length;
        if (count > 0) {
          gitleaksMatches.push({ filePath: file.path, detector: detector.name, severity: detector.severity, count });
        }
      }

      for (const rule of SEMGREP_PATTERNS) {
        const count = [...content.matchAll(rule.pattern)].length;
        if (count > 0) {
          semgrepMatches.push({ filePath: file.path, rule: rule.name, severity: rule.severity, count });
        }
      }
    } catch {
      // best-effort on file content fetch
    }
  }

  return {
    fullName: repoData.full_name,
    defaultBranch: repoData.default_branch,
    filesScanned: scannableFiles.length,
    treeEntries: treeEntries.length,
    repoSizeKb: repoData.size,
    semgrepMatches,
    gitleaksMatches,
  };
}

export async function runFreeRiskScan(input: { repoUrl: string; githubToken?: string }): Promise<FreeRiskScanResult> {
  const startedAt = Date.now();
  const preview = await runPreviewScan({
    repoUrl: input.repoUrl,
    githubToken: input.githubToken || process.env.GITHUB_TOKEN || "",
  });
  const criticalFinding = buildSingleCriticalFinding(preview);

  if (!criticalFinding) {
    throw new Error("No critical or high-severity flaw found in quick scan window");
  }

  return {
    fullName: preview.fullName,
    defaultBranch: preview.defaultBranch,
    filesScanned: preview.filesScanned,
    scanDurationMs: Date.now() - startedAt,
    criticalFinding,
  };
}
