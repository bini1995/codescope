export const SCAN_LIMITS = {
  maxRepoSizeKb: 1024 * 20,
  maxTreeEntries: 20000,
  maxFilesToScan: 1200,
  maxFileSizeBytes: 200000,
  maxPatternScanFiles: 120,
} as const;

export function formatRepoSizeLimitMb(): string {
  return `${Math.round(SCAN_LIMITS.maxRepoSizeKb / 1024)} MB`;
}
