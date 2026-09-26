/**
 * Claim your session key — for a patron whose browser holds their nsec.
 *
 * Renders ONLY when this browser holds the session nsec for the signed-in
 * npub. NIP-07 and courier-proof sign-ins see nothing: no disabled control,
 * no placeholder, no mention. Painting the key takes two deliberate taps —
 * "Claim your session key", then the Reveal (eye) button — so an account page opened
 * in front of other people does not show it.
 *
 * Destinations: copy, download .env, password-manager prompt, and an
 * encrypted DM to another npub the patron names. The nsec never reaches a
 * log, error text, analytics call, or MCP tool argument.
 */

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, Eye, EyeOff, KeyRound, Send } from "lucide-react";
import { tollboothConfig } from "../config.ts";
import {
  passwordManagerOutcomeLabel,
  sessionKeyClaimVisible,
  sessionKeyEnvContents,
  sessionKeyEnvFilename,
  type PasswordManagerOutcome,
} from "../sessionKeyClaim.ts";
import { sendSessionKeyDm } from "../sessionKeyDm.ts";
import {
  getSessionNsec,
  getSessionNsecBytes,
  hasSessionNsec,
  sessionNsecNpub,
} from "../sessionNsec.ts";
import { shareOrDownload } from "../shareFile.ts";
import { card, input, muted } from "./ui.ts";

type Flash = { tone: "ok" | "err"; text: string };

export interface SessionKeyClaimClassNames {
  /** Each round icon action (Reveal, Copy, .env, password manager, DM) when not active. Default: the package's outlined chip. */
  action?: string;
}

export interface SessionKeyClaimProps {
  npub: string;
  classNames?: SessionKeyClaimClassNames;
}

export default function SessionKeyClaim({ npub, classNames = {} }: SessionKeyClaimProps) {
  const visible = sessionKeyClaimVisible({
    hasSessionNsec: hasSessionNsec(),
    sessionNsecNpub: sessionNsecNpub(),
    signedInNpub: npub,
  });

  // Hard requirement: silence when the browser does not hold the key.
  if (!visible) return null;

  return <SessionKeyClaimInner actionClass={classNames.action} />;
}

function SessionKeyClaimInner({ actionClass }: { actionClass?: string }) {
  const { slug, appName } = tollboothConfig();
  const envFilename = sessionKeyEnvFilename(slug);
  const [revealed, setRevealed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const userRef = useRef<HTMLInputElement | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);

  function nsecOrThrow(): string {
    const nsec = getSessionNsec();
    if (!nsec) throw new Error("No session key in this browser.");
    return nsec;
  }

  function note(tone: Flash["tone"], text: string) {
    // Deliberately never interpolate the nsec into flash text.
    setFlash({ tone, text });
  }

  async function copyKey() {
    setBusy(true);
    setFlash(null);
    try {
      const nsec = nsecOrThrow();
      await navigator.clipboard.writeText(nsec);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      note("ok", "Copied. It is on your clipboard only — paste it somewhere you trust.");
    } catch {
      note("err", "Could not copy. Your browser may have blocked the clipboard.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadEnv() {
    setBusy(true);
    setFlash(null);
    try {
      const nsec = nsecOrThrow();
      const body = sessionKeyEnvContents(slug, nsec);
      const file = new File([body], envFilename, {
        type: "text/plain",
      });
      const outcome = await shareOrDownload(file, `${appName} session key`);
      if (outcome === "cancelled") {
        note("ok", "Share cancelled — nothing left this page.");
      } else if (outcome === "blocked") {
        note(
          "err",
          "The share sheet needs a fresh tap. Try Download again.",
        );
      } else if (outcome === "shared") {
        note("ok", "Handed off via the share sheet.");
      } else {
        note(
          "ok",
          `Downloaded ${envFilename}. Import it yourself — the page did not write to any keychain.`,
        );
      }
    } catch {
      note("err", "Could not prepare the download.");
    } finally {
      setBusy(false);
    }
  }

  async function passwordManagerSave() {
    setBusy(true);
    setFlash(null);
    try {
      const nsec = nsecOrThrow();
      const outcome = await offerPasswordManager(
        nsec,
        npubHint(),
        `${appName} session key`,
        formRef.current,
        userRef.current,
        passRef.current,
      );
      note("ok", passwordManagerOutcomeLabel(outcome));
    } catch {
      note("err", passwordManagerOutcomeLabel("unsupported"));
    } finally {
      setBusy(false);
    }
  }

  function npubHint(): string {
    // Username for a password manager entry — the public npub, never secret.
    return sessionNsecNpub() ?? `${slug}-session`;
  }

  async function sendDm() {
    setBusy(true);
    setFlash(null);
    try {
      const nsec = nsecOrThrow();
      const to = recipient.trim();
      if (!to.startsWith("npub1") || to.length < 60) {
        note("err", "Enter the recipient as an npub1… address.");
        return;
      }
      const result = await sendSessionKeyDm({
        appName,
        nsecBytes: getSessionNsecBytes(),
        nsecBech32: nsec,
        recipientNpub: to,
      });
      if (result.ok > 0) {
        note(
          "ok",
          `Encrypted DM accepted by ${result.ok}/${result.total} relays. Open it from the recipient’s Nostr client.`,
        );
        setDmOpen(false);
        setRecipient("");
      } else {
        note(
          "err",
          "No relay accepted the encrypted DM. Try again in a moment.",
        );
      }
    } catch (e) {
      // Message must stay free of the nsec — our thrown errors already are.
      const msg = (e as Error).message || "Could not send the DM.";
      note("err", msg.includes("nsec") ? "Could not send the DM." : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!revealed) {
    return (
      <div className={`${card} px-4 py-3`}>
        <div className="eyebrow mb-1">Session key</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className={`min-w-[14rem] flex-1 text-[12.5px] leading-snug ${muted}`}>
            This browser is holding the secret key that signs you in. Take a copy
            before you clear site data or switch devices — without it, this identity
            is gone.
          </p>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-11 shrink-0 rounded-full border border-[var(--tb-accent)] bg-[var(--tb-accent)] px-4 text-[13px] font-semibold text-[var(--tb-on-accent)]"
          >
            Claim your session key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${card} px-4 py-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="eyebrow mb-1">Session key</div>
        <button
          type="button"
          onClick={() => {
            setRevealed(false);
            setShowKey(false);
            setDmOpen(false);
            setFlash(null);
            setRecipient("");
          }}
          className={`text-[12px] ${muted} hover:text-[var(--tb-ink)]`}
        >
          Hide
        </button>
      </div>
      <p className={`mb-3 text-[12.5px] leading-relaxed ${muted}`}>
        Anyone who holds this key is you. It leaves this page only when you
        choose a destination below — never logged, never sent to {appName}.
      </p>

      <div className="flex flex-wrap gap-2">
        {/* Reveal is its own deliberate tap, a peer of the destinations. */}
        <DestButton
          label={showKey ? "Conceal the key" : "Reveal the key"}
          onClick={() => setShowKey((v) => !v)}
          active={showKey}
          className={actionClass}
        >
          {showKey ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </DestButton>
        <DestButton
          label={copied ? "Copied" : "Copy the key"}
          onClick={() => void copyKey()}
          disabled={busy}
          className={actionClass}
        >
          {copied ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
        </DestButton>
        <DestButton
          label="Download a .env file"
          onClick={() => void downloadEnv()}
          disabled={busy}
          className={actionClass}
        >
          <Download size={20} aria-hidden="true" />
        </DestButton>
        <DestButton
          label="Save to your password manager"
          onClick={() => void passwordManagerSave()}
          disabled={busy}
          className={actionClass}
        >
          <KeyRound size={20} aria-hidden="true" />
        </DestButton>
        <DestButton
          label="Send by encrypted DM"
          onClick={() => {
            setDmOpen((v) => !v);
            setFlash(null);
          }}
          disabled={busy}
          active={dmOpen}
          className={actionClass}
        >
          <Send size={20} aria-hidden="true" />
        </DestButton>
      </div>

      {showKey && (
        <div className="mt-3 break-all rounded-lg border border-[var(--tb-line)] bg-[var(--tb-surface-2)] px-3 py-2 font-mono text-[12px] text-[var(--tb-ink)]">
          {getSessionNsec()}
        </div>
      )}

      {dmOpen && (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--tb-line)] bg-[var(--tb-surface-2)] p-3">
          <p className={`text-[12px] leading-relaxed ${muted}`}>
            Encrypts the key to an npub you own and publishes the sealed message
            to public relays. Only that npub can open it.
          </p>
          <div className="flex flex-wrap items-end gap-2">
          <label className={`block min-w-[16rem] flex-1 text-[12px] ${muted}`}>
            Recipient npub
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="npub1…"
              className={`mt-1 h-11 ${input}`}
            />
          </label>
          <button
            type="button"
            onClick={() => void sendDm()}
            disabled={busy || recipient.trim().length < 60}
            className="min-h-11 shrink-0 rounded-full border border-[var(--tb-accent)] bg-[var(--tb-accent)] px-4 text-[13px] font-semibold text-[var(--tb-on-accent)] disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send encrypted DM"}
          </button>
          </div>
        </div>
      )}

      {/*
        Hidden password form — submitting it is the honest "password manager
        prompt" path when the Credential Management API is missing. Never claim
        an OS keychain write.
      */}
      <form
        ref={formRef}
        className="absolute h-px w-px overflow-hidden opacity-0"
        aria-hidden="true"
        autoComplete="on"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          ref={userRef}
          name="username"
          autoComplete="username"
          defaultValue=""
          readOnly
          tabIndex={-1}
        />
        <input
          ref={passRef}
          name="password"
          type="password"
          autoComplete="new-password"
          defaultValue=""
          readOnly
          tabIndex={-1}
        />
      </form>

      {flash && (
        <p
          className={`mt-3 text-[12.5px] leading-relaxed ${
            flash.tone === "ok" ? "text-[var(--tb-ink)]" : "text-[var(--tb-err-ink)]"
          }`}
          role="status"
        >
          {flash.text}
        </p>
      )}
    </div>
  );
}

/** An icon-only round action. `label` is its aria-label and tooltip. */
function DestButton({
  label,
  onClick,
  disabled,
  active,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const idle =
    className ?? `border-[var(--tb-line)] ${muted} active:bg-[var(--tb-surface-2)]`;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tb-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tb-surface)] disabled:opacity-40 ${
        active
          ? "border-[var(--tb-accent)] bg-[var(--tb-accent)] text-[var(--tb-on-accent)]"
          : idle
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Offer the key to a browser password manager. Never claims an OS keychain.
 * Uses PasswordCredential when available; otherwise fills a hidden form and
 * submits it so the browser can offer a save prompt.
 */
async function offerPasswordManager(
  nsec: string,
  username: string,
  name: string,
  form: HTMLFormElement | null,
  user: HTMLInputElement | null,
  pass: HTMLInputElement | null,
): Promise<PasswordManagerOutcome> {
  type PasswordCredCtor = new (opts: {
    id: string;
    password: string;
    name?: string;
  }) => Credential;
  const Cred = (window as unknown as { PasswordCredential?: PasswordCredCtor })
    .PasswordCredential;
  if (Cred && navigator.credentials?.store) {
    try {
      const cred = new Cred({
        id: username,
        password: nsec,
        name,
      });
      await navigator.credentials.store(cred);
      return "stored";
    } catch {
      // Fall through to the form prompt.
    }
  }

  // Form-based prompt — best-effort. Many browsers ignore programmatic submit
  // for save prompts; we still report honestly that we only prompted.
  if (form && user && pass) {
    user.value = username;
    pass.value = nsec;
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
    // Clear the DOM value immediately so a later inspect does not show it.
    pass.value = "";
    return "prompted";
  }
  return "unsupported";
}
