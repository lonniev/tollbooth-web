/**
 * The text a crash screen offers to copy: the error, where it was thrown, the
 * component stack, and the recent activity log (already scrubbed of secrets).
 */

export function errorReport(error: unknown, componentStack = "", log = ""): string {
  const e = error instanceof Error ? error : null;
  const message = e ? e.message : String(error ?? "(unknown)");
  return [
    `Error: ${message}`,
    e?.stack ? `\n${e.stack}` : "",
    componentStack ? `\nComponent stack:${componentStack}` : "",
    log ? `\n\n--- recent activity ---\n${log}` : "",
  ].join("");
}
