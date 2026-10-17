/**
 * Sends browser errors to /api/client-error so they reach the server log
 * (Cloud Logging in production). At most MAX_REPORTS per page load, and the
 * same message is only sent once, so a render loop can't flood the logs.
 */

const MAX_REPORTS = 5;
const sent = new Set<string>();

export interface ClientErrorReport {
  kind: "error" | "unhandledrejection" | "boundary";
  message: string;
  stack?: string;
  digest?: string;
}

export function reportClientError(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  if (sent.size >= MAX_REPORTS || sent.has(report.message)) return;
  sent.add(report.message);

  const body = JSON.stringify({ ...report, url: window.location.href });
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/client-error", blob)) return;
  } catch {
    // Fall through to fetch.
  }
  void fetch("/api/client-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

/** Turns whatever was thrown into a message and stack. */
export function describeError(value: unknown): {
  message: string;
  stack?: string;
} {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack };
  }
  return { message: typeof value === "string" ? value : String(value) };
}

/** For tests: forget what was sent. */
export function resetErrorReports(): void {
  sent.clear();
}
