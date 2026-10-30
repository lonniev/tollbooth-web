/**
 * Bring your own keys: the panel for an operator whose patrons deliver their
 * own vendor credentials by Secure Courier.
 *
 * It checks what is on file, sends the Nostr DM, and collects the reply once
 * the patron says they sent it. A key never touches the browser. The check
 * failing is said out loud, since silence would read as "nothing needed".
 *
 * Mechanics only: the site supplies the words about its own vendor, and
 * `classNames` per part.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, Inbox, KeyRound, Send } from "lucide-react";
import {
  getPatronOnboardingStatus,
  receivePatronCredentials,
  requestPatronCredentials,
  type PatronOnboardingResult,
} from "../standardTools.ts";
import { cx } from "./cx.ts";
import { afterReceive, afterRequest, type CredentialPhase } from "./patronCredentialsFlow.ts";
import { errBox, muted } from "./ui.ts";

export interface PatronCredentialsPanelClassNames {
  root?: string;
  header?: string;
  heading?: string;
  connected?: string;
  text?: string;
  note?: string;
  phrase?: string;
  actions?: string;
  primary?: string;
  chip?: string;
  link?: string;
  problem?: string;
}

export interface PatronCredentialsPanelProps {
  npub: string;
  /** The panel's heading, e.g. "Your vendor account". */
  heading: ReactNode;
  /** Shown when the keys are on file. */
  connectedText: ReactNode;
  /** Shown before the invitation: why to connect, and which keys to have ready. */
  inviteText: ReactNode;
  /** Where the patron makes the key. */
  keySource?: { href: string; label: string; title?: string };
  /** Called once the keys are stored, so the page can read with them. */
  onConnected?: () => void;
  classNames?: PatronCredentialsPanelClassNames;
}

export default function PatronCredentialsPanel({
  npub,
  heading,
  connectedText,
  inviteText,
  keySource,
  onConnected,
  classNames: c = {},
}: PatronCredentialsPanelProps) {
  const [status, setStatus] = useState<PatronOnboardingResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [phase, setPhase] = useState<CredentialPhase>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await getPatronOnboardingStatus(npub));
      setProblem("");
    } catch (e) {
      setProblem((e as Error).message);
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, [npub]);

  useEffect(() => {
    void check();
  }, [check]);

  async function attempt(step: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await step();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    attempt(async () => {
      const next = afterRequest(await requestPatronCredentials(npub));
      setPhase(next.phase);
      setProblem(next.problem);
    });

  const collect = (phrase: string) =>
    attempt(async () => {
      const next = afterReceive(phase, await receivePatronCredentials(npub, phrase));
      setPhase(next.phase);
      setProblem(next.problem);
      if (next.phase.kind === "done") {
        await check();
        onConnected?.();
      }
    });

  const connected = status?.ready === true;

  return (
    <section className={c.root}>
      <header className={cx("mb-3 flex items-center gap-2", c.header)}>
        <KeyRound size={16} aria-hidden />
        <h2 className={cx("text-sm font-semibold", c.heading)}>{heading}</h2>
        {connected && (
          <span className={cx("ml-auto inline-flex items-center gap-1 text-xs text-[var(--tb-ok)]", c.connected)}>
            <CheckCircle2 size={16} aria-hidden />
            Connected
          </span>
        )}
      </header>

      {checking && <p className={cx("text-sm", muted, c.note)}>Checking…</p>}

      {!checking && connected && <p className={cx("text-sm", muted, c.text)}>{connectedText}</p>}

      {!checking && !connected && phase.kind === "idle" && (
        <div className="space-y-3">
          <p className={cx("text-sm", muted, c.text)}>{inviteText}</p>
          <div className={cx("flex flex-wrap items-center gap-2", c.actions)}>
            <button type="button" onClick={start} disabled={busy} className={cx("inline-flex items-center gap-1.5", c.primary)}>
              <Send size={16} aria-hidden />
              Connect
            </button>
            {keySource && (
              <a
                href={keySource.href}
                target="_blank"
                rel="noopener noreferrer"
                title={keySource.title}
                className={cx("inline-flex items-center gap-1 text-sm", c.link)}
              >
                {keySource.label}
                <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </div>
        </div>
      )}

      {phase.kind === "sent" && (
        <div className="space-y-3">
          <p className={cx("text-sm", muted, c.text)}>
            Check your Nostr messages for one marked <span className={cx("font-mono", c.phrase)}>{phase.phrase}</span> and
            reply with your keys.
          </p>
          {phase.relay && (
            <p className={cx("text-xs", muted, c.note)}>
              Reply on <span className="font-mono">{phase.relay}</span>: replies elsewhere are missed.
            </p>
          )}
          <button
            type="button"
            onClick={() => collect(phase.phrase)}
            disabled={busy}
            className={cx("inline-flex items-center gap-1.5", c.chip)}
          >
            <Inbox size={16} aria-hidden />
            {busy ? "Looking…" : "I replied"}
          </button>
        </div>
      )}

      {problem && <p className={cx("mt-3", errBox, c.problem)}>{problem}</p>}
    </section>
  );
}
