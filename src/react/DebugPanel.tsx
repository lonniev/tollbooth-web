/**
 * The on-screen MCP activity log — a bar fixed to the bottom of the page that
 * shows every call, result and error, so anyone can see what the front end is
 * doing and paste it into a bug report.
 *
 * Collapsed it is one tab whose colour says whether anything failed (red) or
 * is waiting on the patron (a notice: sign in, top up). Open, it lists the log
 * newest first with Copy and Clear. Everything shown comes from the scrubbed
 * store, so no nsec, proof or token can be painted here.
 *
 * `children` is the site's own section — eXcalibur puts its scheduler controls
 * there — drawn above the log while the panel is open.
 *
 * Touch-first: every control is a real button at least 40px square, nothing
 * hides behind hover, and the page under the bar stays tappable.
 */

import { useEffect, useState, type ReactNode } from "react";
import { onProofExpired } from "../client.ts";
import {
  captureGlobalErrors,
  clearDebug,
  debugLogText,
  debugPush,
  debugSeverity,
  type DebugEntry,
  type DebugSeverity,
} from "../debugLog.ts";
import { readStored, writeStored } from "../storage.ts";
import { useDebugLog } from "./useDebugLog.ts";

export interface DebugPanelProps {
  /** The tab's label. Default "Debug". */
  title?: string;
  /** Open on first visit; afterwards the patron's last choice wins. */
  defaultOpen?: boolean;
  /** Fold uncaught errors and proof expiries into the log. Default true. */
  captureErrors?: boolean;
  /** The site's own section, shown above the log while open. */
  children?: ReactNode;
}

const OPEN_KEY = "debug-open";

const TYPE_INK: Record<DebugEntry["type"], string> = {
  info: "text-[var(--tb-accent)]",
  call: "text-[var(--tb-warn-ink)]",
  result: "text-[var(--tb-ok)]",
  error: "text-[var(--tb-err-ink)]",
};

const FLAGGED: Record<Exclude<DebugSeverity, "ok">, { row: string; ink: string }> = {
  failure: { row: "bg-[var(--tb-err-bg)]", ink: "text-[var(--tb-err-ink)] font-bold" },
  notice: { row: "bg-[var(--tb-notice-bg)]", ink: "text-[var(--tb-notice-ink)]" },
};

const tab =
  "min-h-10 min-w-10 rounded-t-lg px-4 text-xs font-medium border border-b-0 transition-colors";
const plainTab = `${tab} bg-[var(--tb-surface-2)] text-[var(--tb-ink)] border-[var(--tb-line)]`;

export default function DebugPanel({
  title = "Debug",
  defaultOpen = false,
  captureErrors = true,
  children,
}: DebugPanelProps) {
  const log = useDebugLog();
  const [open, setOpen] = useState<boolean>(() => {
    const saved = readStored(OPEN_KEY);
    return saved === "" ? defaultOpen : saved === "1";
  });
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");

  useEffect(() => {
    if (!captureErrors) return;
    captureGlobalErrors();
    return onProofExpired((msg) => debugPush("info", `proof expired → back to sign-in: ${msg}`));
  }, [captureErrors]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(""), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  function toggle(): void {
    const next = !open;
    setOpen(next);
    writeStored(OPEN_KEY, next ? "1" : "0");
  }

  function copy(): void {
    const text = debugLogText();
    const clip = globalThis.navigator?.clipboard;
    if (!clip) {
      setCopied("failed");
      return;
    }
    clip.writeText(text).then(
      () => setCopied("ok"),
      () => setCopied("failed"),
    );
  }

  const failures = log.filter((e) => debugSeverity(e) === "failure").length;
  const notices = log.filter((e) => debugSeverity(e) === "notice").length;
  const toggleTone =
    failures > 0
      ? "bg-[var(--tb-err-bg)] text-[var(--tb-err-ink)] border-[var(--tb-err-line)]"
      : notices > 0
        ? "bg-[var(--tb-notice-bg)] text-[var(--tb-notice-ink)] border-[var(--tb-notice-line)]"
        : "bg-[var(--tb-surface-2)] text-[var(--tb-ink)] border-[var(--tb-line)]";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end">
      {/* The controls sit above the log, never over it, so Hide is always reachable. */}
      <div className="pointer-events-auto flex flex-wrap justify-end gap-1 pr-3">
        {open && (
          <>
            <button type="button" onClick={copy} className={plainTab} aria-label="Copy the whole log">
              {copied === "ok" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}
            </button>
            <button type="button" onClick={clearDebug} className={plainTab}>
              Clear
            </button>
          </>
        )}
        <button type="button" onClick={toggle} aria-expanded={open} className={`${tab} ${toggleTone}`}>
          {open ? "Hide" : title} ({log.length}
          {failures > 0 ? ` · ${failures} err` : ""}
          {notices > 0 ? ` · ${notices} notice` : ""})
        </button>
      </div>
      {open && (
        <div className="pointer-events-auto max-h-[40vh] w-full overflow-y-auto border-t border-[var(--tb-line)] bg-[var(--tb-surface)] p-3 font-mono text-xs text-[var(--tb-ink)]">
          {children && <div className="mb-2 border-b border-[var(--tb-line)] pb-2 font-sans">{children}</div>}
          {log.length === 0 && <div className="text-[var(--tb-muted)]">No MCP activity yet.</div>}
          {log.map((entry, i) => {
            const sev = debugSeverity(entry);
            const flag = sev === "ok" ? null : FLAGGED[sev];
            return (
              <div key={log.length - i} className={`-mx-1 flex gap-2 rounded px-1 py-0.5 ${flag?.row ?? ""}`}>
                <span className="shrink-0 text-[var(--tb-muted)]">{entry.ts}</span>
                <span className={`w-14 shrink-0 ${flag?.ink ?? TYPE_INK[entry.type]}`}>
                  {sev === "notice" ? "notice" : entry.type}
                  {sev === "failure" && entry.type !== "error" ? " !" : ""}
                </span>
                <span className={`min-w-0 break-all ${flag?.ink ?? ""}`}>{entry.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
