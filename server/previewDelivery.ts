import { formatRepoSizeLimitMb } from "@shared/scan-limits";
import type { PreviewScanResult } from "./previewScan";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildPreviewPdf(scan: PreviewScanResult): Buffer {
  const lines = [
    `CodeScope Preview Report`,
    `Repository: ${scan.fullName}`,
    `Default branch: ${scan.defaultBranch}`,
    `Repository size: ${scan.repoSizeKb} KB (limit ${formatRepoSizeLimitMb()})`,
    `Tree entries: ${scan.treeEntries}`,
    `Files scanned: ${scan.filesScanned}`,
    ``,
    `Gitleaks-style findings: ${scan.gitleaksMatches.length}`,
    ...scan.gitleaksMatches.slice(0, 12).map((m) => `- [${m.severity}] ${m.detector} in ${m.filePath} (x${m.count})`),
    ``,
    `Semgrep-style findings: ${scan.semgrepMatches.length}`,
    ...scan.semgrepMatches.slice(0, 12).map((m) => `- [${m.severity}] ${m.rule} in ${m.filePath} (x${m.count})`),
  ];

  const contentLines = lines.slice(0, 42);
  const textOps = ["BT", "/F1 11 Tf", "50 790 Td"];
  let previousBlank = false;
  for (const rawLine of contentLines) {
    const line = rawLine.length ? rawLine : " ";
    if (!previousBlank && rawLine.length === 0) {
      textOps.push("0 -8 Td");
      previousBlank = true;
      continue;
    }
    textOps.push(`(${escapePdfText(line.slice(0, 120))}) Tj`);
    textOps.push("0 -16 Td");
    previousBlank = false;
  }
  textOps.push("ET");

  const stream = textOps.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export async function emailPreviewPdf(input: {
  to: string;
  repoUrl: string;
  scan: PreviewScanResult;
  pdf: Buffer;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PREVIEW_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and PREVIEW_EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `CodeScope preview report for ${input.scan.fullName}`,
      html: `<p>Your preview scan is ready for <strong>${input.scan.fullName}</strong>.</p><p>Repo: ${input.repoUrl}</p>`,
      attachments: [
        {
          filename: `${input.scan.fullName.replace("/", "-")}-preview.pdf`,
          content: input.pdf.toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Email delivery failed: ${response.status} ${text}`);
  }
}
