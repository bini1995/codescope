import { getUncachableGitHubClient } from "./github";
import { storage } from "./storage";
import type { InsertFinding, RepoMeta, FileTreeItem, ScanLogEntry } from "@shared/schema";

const SECRET_PATTERNS = [
  { pattern: /(?:sk_live_|sk_test_)[a-zA-Z0-9]{20,}/g, name: "Stripe Secret Key", severity: "critical" as const },
  { pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, name: "AWS Access Key", severity: "critical" as const },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, name: "GitHub Personal Access Token", severity: "critical" as const },
  { pattern: /gho_[a-zA-Z0-9]{36}/g, name: "GitHub OAuth Token", severity: "critical" as const },
  { pattern: /xox[bpors]-[a-zA-Z0-9\-]{10,}/g, name: "Slack Token", severity: "critical" as const },
  { pattern: /(?:mongodb(?:\+srv)?:\/\/)[^\s'"]+/g, name: "MongoDB Connection String", severity: "critical" as const },
  { pattern: /postgres(?:ql)?:\/\/[^\s'"]+/g, name: "PostgreSQL Connection String", severity: "critical" as const },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, name: "Hardcoded Password", severity: "high" as const },
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}['"]/gi, name: "Hardcoded API Key", severity: "high" as const },
  { pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, name: "Hardcoded Secret/Token", severity: "high" as const },
  { pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, name: "Private Key in Source", severity: "critical" as const },
];

const SECURITY_PATTERNS = [
  {
    pattern: /(?:query|execute|exec)\s*\(\s*[`'"].*\$\{/g,
    name: "Potential SQL Injection (template literal)",
    severity: "high" as const,
    category: "security",
    impact: "User input interpolated directly into SQL queries can allow attackers to read, modify, or delete your entire database.",
    fix: "Use parameterized queries or your ORM's query builder instead of string interpolation in SQL.",
  },
  {
    pattern: /\.query\s*\(\s*['"].*\+\s*(?:req\.|input|user|params|body)/g,
    name: "SQL Injection via String Concatenation",
    severity: "high" as const,
    category: "security",
    impact: "Concatenating user input into SQL strings allows arbitrary query execution.",
    fix: "Replace string concatenation with parameterized queries using placeholders ($1, ?, etc.).",
  },
  {
    pattern: /cors\(\s*\{?\s*origin\s*:\s*(?:true|['"]\*['"]|\[.*\*.*\])/g,
    name: "Unsafe CORS Configuration",
    severity: "medium" as const,
    category: "security",
    impact: "Allowing all origins means any website can make authenticated requests to your API, enabling CSRF-like attacks.",
    fix: "Restrict CORS origin to your specific domain(s): cors({ origin: 'https://yourdomain.com' })",
  },
  {
    pattern: /eval\s*\(/g,
    name: "Use of eval()",
    severity: "high" as const,
    category: "security",
    impact: "eval() executes arbitrary code and can be exploited for remote code execution if user input reaches it.",
    fix: "Remove eval() and use safe alternatives like JSON.parse() for data parsing or Function constructors for dynamic code.",
  },
  {
    pattern: /dangerouslySetInnerHTML/g,
    name: "dangerouslySetInnerHTML Usage",
    severity: "medium" as const,
    category: "security",
    impact: "Rendering unescaped HTML can lead to Cross-Site Scripting (XSS) attacks if the content comes from user input.",
    fix: "Sanitize HTML with a library like DOMPurify before rendering, or use safe React patterns instead.",
  },
  {
    pattern: /(?:res|response)\.redirect\s*\(\s*(?:req\.|params|query|body)/g,
    name: "Open Redirect Vulnerability",
    severity: "medium" as const,
    category: "security",
    impact: "Redirecting to user-supplied URLs can be used in phishing attacks to trick users into visiting malicious sites.",
    fix: "Validate redirect URLs against a whitelist of allowed domains before redirecting.",
  },
];

const STABILITY_PATTERNS = [
  {
    pattern: /catch\s*\(\s*(?:e|err|error)?\s*\)\s*\{\s*\}/g,
    name: "Empty Catch Block",
    severity: "medium" as const,
    impact: "Silently swallowing errors makes debugging impossible and can hide critical failures in production.",
    fix: "At minimum, log the error: catch(err) { console.error('Context:', err); }. Better: add proper error handling logic.",
  },
  {
    pattern: /console\.log\s*\(/g,
    name: "Console.log in Production Code",
    severity: "low" as const,
    impact: "Console logs can leak sensitive data and clutter production output. They indicate a lack of structured logging.",
    fix: "Replace with a structured logger (winston, pino) and remove debug console.logs before shipping.",
  },
  {
    pattern: /process\.exit\s*\(/g,
    name: "process.exit() Call",
    severity: "medium" as const,
    impact: "Abrupt process termination prevents graceful shutdown, can corrupt data, and drops in-flight requests.",
    fix: "Use proper shutdown handlers and let the process exit naturally after cleanup.",
  },
];

const MAINTAINABILITY_PATTERNS = [
  {
    pattern: /\/\/\s*TODO/gi,
    name: "TODO Comment",
    severity: "low" as const,
    impact: "Unresolved TODOs indicate incomplete work that may be forgotten and become technical debt.",
    fix: "Track TODOs as issues in your project management tool and address them before shipping.",
  },
  {
    pattern: /\/\/\s*HACK|\/\/\s*FIXME|\/\/\s*XXX/gi,
    name: "HACK/FIXME Comment",
    severity: "medium" as const,
    impact: "These comments flag known problematic code that needs attention. Shipping with these is risky.",
    fix: "Address the underlying issue or create a tracked ticket with a deadline.",
  },
  {
    pattern: /any(?:\s*[;,\)\]])/g,
    name: "TypeScript 'any' Type Usage",
    severity: "low" as const,
    impact: "Using 'any' defeats TypeScript's type safety, allowing bugs that the type system would normally catch.",
    fix: "Replace 'any' with proper types. Use 'unknown' if the type is genuinely unknown and add type guards.",
  },
];

const SENSITIVE_FILES = [
  { path: ".env", severity: "critical" as const, title: ".env File Committed to Repository" },
  { path: ".env.local", severity: "critical" as const, title: ".env.local File Committed" },
  { path: ".env.production", severity: "critical" as const, title: ".env.production File Committed" },
  { path: ".env.development", severity: "high" as const, title: ".env.development File Committed" },
  { path: "id_rsa", severity: "critical" as const, title: "SSH Private Key Committed" },
  { path: "id_ed25519", severity: "critical" as const, title: "SSH Private Key Committed" },
  { path: ".npmrc", severity: "high" as const, title: ".npmrc File May Contain Auth Token" },
  { path: "firebase-adminsdk", severity: "critical" as const, title: "Firebase Admin SDK Credentials File" },
  { path: "service-account", severity: "critical" as const, title: "GCP Service Account Key File" },
  { path: "credentials.json", severity: "critical" as const, title: "Credentials File Committed" },
];

const IMPORTANT_FILES = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".gitignore",
  "requirements.txt",
  "Pipfile",
  "pyproject.toml",
  "Gemfile",
  "go.mod",
  "Cargo.toml",
  "docker-compose.yml",
  "Dockerfile",
  ".github/workflows",
  "tsconfig.json",
  "next.config.js",
  "next.config.ts",
  "vite.config.ts",
  "vite.config.js",
];

const SCANNABLE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java",
  ".env", ".yml", ".yaml", ".json", ".toml",
  ".sql", ".graphql", ".gql",
  ".php", ".cs", ".swift", ".kt",
];

function shouldScanFile(path: string): boolean {
  const ext = "." + path.split(".").pop()?.toLowerCase();
  return SCANNABLE_EXTENSIONS.includes(ext);
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

function truncateSnippet(content: string, lineNum: number, contextLines: number = 2): string {
  const lines = content.split("\n");
  const start = Math.max(0, lineNum - contextLines - 1);
  const end = Math.min(lines.length, lineNum + contextLines);
  return lines.slice(start, end).map((l, i) => `${start + i + 1} | ${l}`).join("\n");
}

export async function scanRepository(auditId: string): Promise<void> {
  const audit = await storage.getAudit(auditId);
  if (!audit) throw new Error("Audit not found");

  const log: ScanLogEntry[] = [];
  const addLog = (step: string, status: "ok" | "warn" | "error", message: string) => {
    log.push({ step, status, message, timestamp: new Date().toISOString() });
  };

  await storage.updateAudit(auditId, { status: "in_progress", scanLog: log });

  try {
    const octokit = await getUncachableGitHubClient();
    addLog("connect", "ok", "Connected to GitHub API");

    let repoData;
    try {
      const { data } = await octokit.repos.get({ owner: audit.ownerName, repo: audit.repoName });
      repoData = data;
      addLog("fetch_repo", "ok", `Fetched repository: ${data.full_name}`);
    } catch (err: any) {
      addLog("fetch_repo", "error", `Cannot access repo: ${err.message}`);
      await storage.updateAudit(auditId, {
        status: "complete",
        scanLog: log,
        scannedAt: new Date(),
        executiveSummary: "Unable to access this repository. Please ensure the repo exists and the GitHub connection has access.",
      });
      return;
    }

    const repoMeta: RepoMeta = {
      languages: {},
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      defaultBranch: repoData.default_branch,
      lastPush: repoData.pushed_at || "",
      isPrivate: repoData.private,
      description: repoData.description,
      size: repoData.size,
    };

    try {
      const { data: langData } = await octokit.repos.listLanguages({ owner: audit.ownerName, repo: audit.repoName });
      repoMeta.languages = langData;
      addLog("languages", "ok", `Detected languages: ${Object.keys(langData).join(", ")}`);
    } catch {
      addLog("languages", "warn", "Could not fetch language data");
    }

    await storage.updateAudit(auditId, { repoMeta, scanLog: log });

    let tree: FileTreeItem[] = [];
    try {
      const { data: treeData } = await octokit.git.getTree({
        owner: audit.ownerName,
        repo: audit.repoName,
        tree_sha: repoData.default_branch,
        recursive: "true",
      });
      tree = treeData.tree
        .filter((t) => t.type === "blob" || t.type === "tree")
        .map((t) => ({
          path: t.path || "",
          type: t.type === "blob" ? "file" as const : "dir" as const,
          size: t.size,
        }));
      addLog("file_tree", "ok", `Found ${tree.length} files/directories`);
    } catch (err: any) {
      addLog("file_tree", "error", `Cannot fetch file tree: ${err.message}`);
    }

    await storage.updateAudit(auditId, { fileTree: tree, scanLog: log });

    const allFindings: Omit<InsertFinding, "auditId">[] = [];

    const files = tree.filter((t) => t.type === "file");

    for (const sensitiveFile of SENSITIVE_FILES) {
      const match = files.find((f) =>
        f.path.endsWith(sensitiveFile.path) ||
        f.path.includes(`/${sensitiveFile.path}`)
      );
      if (match) {
        allFindings.push({
          category: "security",
          severity: sensitiveFile.severity,
          title: sensitiveFile.title,
          description: `The file "${match.path}" should never be committed to version control. It likely contains secrets, credentials, or sensitive configuration.`,
          filePath: match.path,
          lineStart: null,
          lineEnd: null,
          codeSnippet: null,
          businessImpact: "Anyone with access to the repository (including if it becomes public) can extract secrets from this file and gain unauthorized access to your systems.",
          fixSteps: `1. Remove the file from the repository: git rm --cached ${match.path}\n2. Add it to .gitignore\n3. Rotate any secrets that were in the file\n4. Use git filter-branch or BFG to remove from history`,
          effort: "S",
          status: "open",
          autoDetected: true,
        });
        addLog("sensitive_file", "warn", `Found sensitive file: ${match.path}`);
      }
    }

    const hasGitignore = files.some((f) => f.path === ".gitignore");
    if (!hasGitignore) {
      allFindings.push({
        category: "security",
        severity: "high",
        title: "Missing .gitignore File",
        description: "No .gitignore file found in the repository root. Without it, sensitive files, build artifacts, and dependency folders may be committed.",
        filePath: null,
        lineStart: null,
        lineEnd: null,
        codeSnippet: null,
        businessImpact: "Secrets, node_modules, .env files, and other sensitive/unnecessary files may be committed to the repo.",
        fixSteps: "1. Create a .gitignore file at the project root\n2. Use a template from gitignore.io for your stack\n3. At minimum include: node_modules/, .env*, dist/, build/, *.log",
        effort: "S",
        status: "open",
        autoDetected: true,
      });
    }

    const hasLockfile = files.some((f) =>
      ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(f.path)
    );
    const hasPackageJson = files.some((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
    if (hasPackageJson && !hasLockfile) {
      allFindings.push({
        category: "stability",
        severity: "high",
        title: "Missing Package Lock File",
        description: "No package-lock.json, yarn.lock, or pnpm-lock.yaml found. Builds are non-deterministic without a lockfile.",
        filePath: null,
        lineStart: null,
        lineEnd: null,
        codeSnippet: null,
        businessImpact: "Different installs will get different dependency versions. This leads to 'works on my machine' bugs and can introduce breaking changes without warning.",
        fixSteps: "1. Run npm install (or yarn/pnpm install) to generate a lockfile\n2. Commit the lockfile to version control\n3. Use npm ci in CI/CD for deterministic builds",
        effort: "S",
        status: "open",
        autoDetected: true,
      });
    }

    const hasCICD = files.some((f) => f.path.startsWith(".github/workflows/"));
    if (!hasCICD) {
      allFindings.push({
        category: "cicd",
        severity: "medium",
        title: "No CI/CD Pipeline Configured",
        description: "No GitHub Actions workflows found. There are no automated checks running on pull requests or deployments.",
        filePath: null,
        lineStart: null,
        lineEnd: null,
        codeSnippet: null,
        businessImpact: "Without CI/CD, bugs and security issues reach production unchecked. Manual deployments are error-prone and not auditable.",
        fixSteps: "1. Create .github/workflows/ci.yml\n2. Add steps for: lint, type-check, test, dependency audit\n3. Enable branch protection requiring CI to pass\n4. Consider adding secret scanning (gitleaks)",
        effort: "M",
        status: "open",
        autoDetected: true,
      });
    }

    const scannableFiles = files
      .filter((f) => shouldScanFile(f.path) && (f.size ?? 0) < 200000)
      .slice(0, 80);

    addLog("scan_files", "ok", `Scanning ${scannableFiles.length} files for patterns`);
    await storage.updateAudit(auditId, { scanLog: log });

    let filesScanned = 0;
    for (const file of scannableFiles) {
      try {
        const { data } = await octokit.repos.getContent({
          owner: audit.ownerName,
          repo: audit.repoName,
          path: file.path,
        });

        if ("content" in data && data.encoding === "base64") {
          const content = Buffer.from(data.content, "base64").toString("utf-8");

          for (const secretPattern of SECRET_PATTERNS) {
            const matches = [...content.matchAll(secretPattern.pattern)];
            if (matches.length > 0) {
              const lineNum = getLineNumber(content, matches[0].index!);
              const redactedMatch = matches[0][0].substring(0, 12) + "..." + matches[0][0].slice(-4);
              allFindings.push({
                category: "security",
                severity: secretPattern.severity,
                title: `${secretPattern.name} Found in Source Code`,
                description: `A ${secretPattern.name.toLowerCase()} was detected in ${file.path}. This secret is accessible to anyone who can read the repository.`,
                filePath: file.path,
                lineStart: lineNum,
                lineEnd: lineNum,
                codeSnippet: truncateSnippet(content, lineNum),
                businessImpact: "Exposed credentials can be used by attackers to access your systems, steal data, or incur charges on your accounts.",
                fixSteps: `1. Immediately rotate this credential\n2. Move it to an environment variable\n3. Add the file pattern to .gitignore if appropriate\n4. Use git filter-branch or BFG to remove from git history`,
                effort: "S",
                status: "open",
                autoDetected: true,
              });
            }
          }

          for (const sp of SECURITY_PATTERNS) {
            const matches = [...content.matchAll(sp.pattern)];
            if (matches.length > 0) {
              const lineNum = getLineNumber(content, matches[0].index!);
              allFindings.push({
                category: sp.category,
                severity: sp.severity,
                title: `${sp.name} in ${file.path}`,
                description: `Pattern detected: ${sp.name}. Found ${matches.length} occurrence(s) in this file.`,
                filePath: file.path,
                lineStart: lineNum,
                lineEnd: lineNum,
                codeSnippet: truncateSnippet(content, lineNum),
                businessImpact: sp.impact,
                fixSteps: sp.fix,
                effort: "S",
                status: "open",
                autoDetected: true,
              });
            }
          }

          for (const sp of STABILITY_PATTERNS) {
            const matches = [...content.matchAll(sp.pattern)];
            if (matches.length > 2) {
              allFindings.push({
                category: "stability",
                severity: sp.severity,
                title: `${sp.name} (${matches.length} occurrences in ${file.path})`,
                description: `Found ${matches.length} instances of this pattern in a single file.`,
                filePath: file.path,
                lineStart: getLineNumber(content, matches[0].index!),
                lineEnd: null,
                codeSnippet: null,
                businessImpact: sp.impact,
                fixSteps: sp.fix,
                effort: "S",
                status: "open",
                autoDetected: true,
              });
            }
          }

          for (const sp of MAINTAINABILITY_PATTERNS) {
            const matches = [...content.matchAll(sp.pattern)];
            if (matches.length > 3) {
              allFindings.push({
                category: "maintainability",
                severity: sp.severity,
                title: `${sp.name} (${matches.length} in ${file.path})`,
                description: `Found ${matches.length} instances in this file.`,
                filePath: file.path,
                lineStart: null,
                lineEnd: null,
                codeSnippet: null,
                businessImpact: sp.impact,
                fixSteps: sp.fix,
                effort: "S",
                status: "open",
                autoDetected: true,
              });
            }
          }

          const lineCount = content.split("\n").length;
          if (lineCount > 500) {
            allFindings.push({
              category: "maintainability",
              severity: lineCount > 1000 ? "medium" : "low",
              title: `Large File: ${file.path} (${lineCount} lines)`,
              description: `This file has ${lineCount} lines. Large files are harder to review, test, and maintain.`,
              filePath: file.path,
              lineStart: 1,
              lineEnd: lineCount,
              codeSnippet: null,
              businessImpact: "Large files increase cognitive load, slow down code reviews, and make it harder to isolate bugs.",
              fixSteps: "1. Identify distinct responsibilities in the file\n2. Split into smaller modules by domain/function\n3. Use barrel exports (index.ts) for clean imports",
              effort: "M",
              status: "open",
              autoDetected: true,
            });
          }

          filesScanned++;
        }
      } catch {
        // File couldn't be fetched, skip
      }
    }

    addLog("pattern_scan", "ok", `Scanned ${filesScanned} files, found ${allFindings.length} issues`);

    if (hasPackageJson) {
      try {
        const pkgFile = files.find((f) => f.path === "package.json");
        if (pkgFile) {
          const { data } = await octokit.repos.getContent({
            owner: audit.ownerName,
            repo: audit.repoName,
            path: "package.json",
          });
          if ("content" in data && data.encoding === "base64") {
            const content = Buffer.from(data.content, "base64").toString("utf-8");
            try {
              const pkg = JSON.parse(content);
              const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

              if (!allDeps["eslint"] && !allDeps["biome"] && !allDeps["@biomejs/biome"]) {
                allFindings.push({
                  category: "maintainability",
                  severity: "low",
                  title: "No Linter Configured",
                  description: "No ESLint or Biome found in dependencies. Code quality is not being enforced automatically.",
                  filePath: "package.json",
                  lineStart: null,
                  lineEnd: null,
                  codeSnippet: null,
                  businessImpact: "Without a linter, code quality degrades over time and common bugs go undetected.",
                  fixSteps: "1. Install ESLint: npm install -D eslint\n2. Create .eslintrc configuration\n3. Add lint script to package.json\n4. Consider adding to CI pipeline",
                  effort: "S",
                  status: "open",
                  autoDetected: true,
                });
              }

              const hasTypeScript = !!allDeps["typescript"];
              if (hasTypeScript && !files.some((f) => f.path === "tsconfig.json")) {
                allFindings.push({
                  category: "stability",
                  severity: "medium",
                  title: "TypeScript Installed but tsconfig.json Missing",
                  description: "TypeScript is in dependencies but no tsconfig.json found. TypeScript may not be properly configured.",
                  filePath: "package.json",
                  lineStart: null,
                  lineEnd: null,
                  codeSnippet: null,
                  businessImpact: "Without proper TypeScript configuration, type checking may be too loose or not running at all.",
                  fixSteps: "1. Run npx tsc --init to generate tsconfig.json\n2. Configure strict mode for best type safety\n3. Set appropriate target and module settings",
                  effort: "S",
                  status: "open",
                  autoDetected: true,
                });
              }

              addLog("package_analysis", "ok", `Analyzed package.json: ${Object.keys(allDeps).length} dependencies`);
            } catch {
              addLog("package_analysis", "warn", "Could not parse package.json");
            }
          }
        }
      } catch {
        addLog("package_analysis", "warn", "Could not fetch package.json");
      }
    }

    const deduped = deduplicateFindings(allFindings);
    for (const finding of deduped) {
      await storage.createFinding({ ...finding, auditId });
    }

    const scores = calculateScores(deduped);
    const summary = generateSummary(audit.ownerName, audit.repoName, deduped, scores);
    const plan = generateRemediationPlan(deduped);

    addLog("complete", "ok", `Scan complete: ${deduped.length} findings, ${Object.values(scores).reduce((a, b) => a + b, 0) / 5} avg score`);

    await storage.updateAudit(auditId, {
      status: "complete",
      ...scores,
      executiveSummary: summary,
      remediationPlan: plan,
      scanLog: log,
      scannedAt: new Date(),
    });
  } catch (err: any) {
    addLog("error", "error", err.message);
    await storage.updateAudit(auditId, {
      status: "complete",
      scanLog: log,
      scannedAt: new Date(),
      executiveSummary: `Scan encountered an error: ${err.message}. Some results may be incomplete.`,
    });
  }
}

function deduplicateFindings(findings: Omit<InsertFinding, "auditId">[]): Omit<InsertFinding, "auditId">[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.title}:${f.filePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function calculateScores(findings: Omit<InsertFinding, "auditId">[]): {
  securityScore: number;
  stabilityScore: number;
  maintainabilityScore: number;
  scalabilityScore: number;
  cicdScore: number;
} {
  const penalty = { critical: 3, high: 2, medium: 1, low: 0.3 };
  const cats = ["security", "stability", "maintainability", "scalability", "cicd"];
  const scores: Record<string, number> = {};

  for (const cat of cats) {
    const catFindings = findings.filter((f) => f.category === cat);
    let score = 10;
    for (const f of catFindings) {
      score -= penalty[f.severity as keyof typeof penalty] || 0.5;
    }
    scores[cat + "Score"] = Math.max(0, Math.min(10, Math.round(score)));
  }

  return scores as any;
}

function generateSummary(owner: string, repo: string, findings: Omit<InsertFinding, "auditId">[], scores: any): string {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const highs = findings.filter((f) => f.severity === "high").length;
  const mediums = findings.filter((f) => f.severity === "medium").length;

  const avgScore = Math.round(
    (scores.securityScore + scores.stabilityScore + scores.maintainabilityScore +
      scores.scalabilityScore + scores.cicdScore) / 5
  );

  let summary = `Automated scan of ${owner}/${repo} identified ${findings.length} issues: `;
  summary += `${criticals} critical, ${highs} high, ${mediums} medium severity. `;
  summary += `Overall health score: ${avgScore}/10. `;

  if (criticals > 0) {
    summary += `Immediate attention required for ${criticals} critical finding(s) that pose significant security or stability risks. `;
  }

  if (scores.securityScore <= 4) {
    summary += "Security posture needs significant improvement. ";
  }
  if (scores.stabilityScore <= 4) {
    summary += "Build stability is at risk due to configuration or dependency issues. ";
  }
  if (!findings.some((f) => f.category === "cicd")) {
    summary += "CI/CD is not configured, leaving the deployment pipeline unprotected.";
  }

  return summary;
}

function generateRemediationPlan(findings: Omit<InsertFinding, "auditId">[]): any[] {
  const criticals = findings.filter((f) => f.severity === "critical");
  const highs = findings.filter((f) => f.severity === "high");
  const mediums = findings.filter((f) => f.severity === "medium");

  const plan = [];

  if (criticals.length > 0) {
    plan.push({
      phase: "Stop the Bleeding",
      days: "Day 1-2",
      tasks: criticals.slice(0, 5).map((f) => f.title),
    });
  }

  if (highs.length > 0) {
    plan.push({
      phase: "Stabilize",
      days: criticals.length > 0 ? "Day 3-7" : "Day 1-5",
      tasks: highs.slice(0, 5).map((f) => f.title),
    });
  }

  if (mediums.length > 0) {
    plan.push({
      phase: "Harden",
      days: criticals.length > 0 ? "Day 8-14" : highs.length > 0 ? "Day 6-14" : "Day 1-7",
      tasks: mediums.slice(0, 5).map((f) => f.title),
    });
  }

  if (plan.length === 0) {
    plan.push({
      phase: "Maintenance",
      days: "Ongoing",
      tasks: ["Continue monitoring for new vulnerabilities", "Keep dependencies up to date"],
    });
  }

  return plan;
}
