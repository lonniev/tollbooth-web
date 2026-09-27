/**
 * Sign in with an npub (a DM challenge) or an nsec (an in-browser session key).
 *
 *   begin → request_npub_proof → awaiting reply → receive_npub_proof → app
 *
 * Success is not a `verified` flag but "no `error` and a token came back".
 *
 * Around the card: the site's `welcome` (its own words about what this place
 * is for), the network's register line, and — below — `SignInSteps`, which
 * shows the sequence above with the step under way lit from this component's
 * real stage, and `SignInLinks`, the two tools a newcomer needs. Both take the
 * gate's default look here; a site restyles them through `classNames`.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";
import { tollboothConfig } from "../config.ts";
import {
  forgetRecentLogin,
  getLastTypedNpub,
  getValidRecentLogins,
  recordRecentLogin,
  setLastTypedNpub,
  setStoredNpub,
  setStoredProof,
  type RecentLogin,
} from "../identity.ts";
import { setSessionNsec } from "../sessionNsec.ts";
import { readSignInFailure } from "../signInSituation.ts";
import { receiveNpubProof, requestNpubProof } from "../standardTools.ts";
import { cx } from "./cx.ts";
import SignInLinks, { type SignInLinksClassNames } from "./SignInLinks.tsx";
import SignInSteps, { type SignInStepsClassNames } from "./SignInSteps.tsx";
import { gateStage } from "./signInFlow.ts";
import { card, errBox, ghost, input, muted, primary, warnBox } from "./ui.ts";

type Stage = "begin" | "awaiting" | "checking";

export interface NpubGateClassNames {
  root?: string;
  /** Around the site's `welcome`. */
  welcome?: string;
  /** The network's register line under the heading. */
  register?: string;
  /** The sequence strip's parts; the gate's defaults apply where unset. */
  steps?: SignInStepsClassNames;
  /** The tools list's parts; the gate's defaults apply where unset. */
  links?: SignInLinksClassNames;
}

export interface NpubGateProps {
  onLogin: () => void;
  /** Arrive with a key already made, for a first-timer who asked for one. */
  startFresh?: boolean;
  /** Operator fingerprint, shown so the patron can check who sent the message. */
  operatorHash?: string;
  /** A routine re-auth prompt, drawn as a calm note rather than an error. */
  notice?: string;
  /** The site's own words about what this place is for, above the card. */
  welcome?: ReactNode;
  /** The sequence strip under the card. Default true. */
  steps?: boolean;
  /** The 0xchat / Pricing Studio links under the strip. Default true. */
  links?: boolean;
  /** The trademark credit under the links. Default true; false when the page's footer carries it. */
  linksCredit?: boolean;
  classNames?: NpubGateClassNames;
}

const STEPS_LOOK: SignInStepsClassNames = {
  root: "mt-6 space-y-1.5",
  step: "grid grid-cols-[1.5rem_auto_1fr] items-baseline gap-x-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
  done: "border-transparent text-[var(--tb-muted)] opacity-70",
  current: "border-[var(--tb-accent)] bg-[var(--tb-surface)] text-[var(--tb-ink)]",
  todo: "border-transparent text-[var(--tb-muted)]",
  index: "font-mono text-[10px] tabular-nums",
  actor: "font-medium",
  label: "",
};

const LINKS_LOOK: SignInLinksClassNames = {
  root: "mt-6 space-y-2",
  lead: `text-xs ${muted}`,
  list: "space-y-1.5",
  link: `${card} block px-3 py-2.5 hover:border-[var(--tb-accent)] transition-colors`,
  name: "block text-sm font-medium",
  line: `block text-xs ${muted}`,
  credit: `text-[10px] leading-relaxed ${muted}`,
};

export default function NpubGate({
  onLogin,
  startFresh = false,
  operatorHash,
  notice,
  welcome,
  steps = true,
  links = true,
  linksCredit = true,
  classNames: c = {},
}: NpubGateProps) {
  const { appName } = tollboothConfig();
  // Prefilled from what was typed last, NOT from the stored identity.
  const [value, setValue] = useState(getLastTypedNpub());
  const [stage, setStage] = useState<Stage>("begin");
  const [pendingProof, setPendingProof] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [recents, setRecents] = useState<RecentLogin[]>(() => getValidRecentLogins());
  const [generatedHint, setGeneratedHint] = useState(false);

  // Once, on arrival, and only into an empty field — a key generated over
  // something already typed would be a key that ate their nsec.
  const made = useRef(false);
  useEffect(() => {
    if (!startFresh || made.current || value.trim()) return;
    made.current = true;
    generateKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFresh]);

  const trimmed = value.trim();
  const isNsec = trimmed.startsWith("nsec1") && trimmed.length > 8;
  const isNpub = trimmed.startsWith("npub1") && trimmed.length >= 60;
  const valid = isNsec || isNpub;

  function reuseRecent(entry: RecentLogin) {
    setStoredNpub(entry.npub);
    setStoredProof(entry.proof);
    recordRecentLogin(entry.npub, entry.proof, Math.floor((entry.expiresAt - Date.now()) / 1000));
    onLogin();
  }

  function forget(npub: string) {
    forgetRecentLogin(npub);
    setRecents(getValidRecentLogins());
  }

  function generateKey() {
    setValue(nip19.nsecEncode(generateSecretKey()));
    setGeneratedHint(true);
    setError("");
  }

  // The session key proves the npub it derives to, so storing it at once takes
  // nothing on trust.
  function signInWithNsec() {
    setError("");
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type !== "nsec") throw new Error("Not a bech32 nsec");
      const npub = nip19.npubEncode(getPublicKey(decoded.data as Uint8Array));
      setSessionNsec(trimmed);
      setStoredNpub(npub);
      setLastTypedNpub(npub);
      onLogin();
    } catch (e) {
      setError(`Couldn't read that nsec: ${(e as Error).message}`);
    }
  }

  async function begin() {
    if (!isNpub) {
      setError("Enter a valid npub1… key.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await requestNpubProof(
        trimmed,
        globalThis.location.origin,
        `You requested to sign in to ${appName} (${globalThis.location.host}).`,
      );
      if (r.error) return setError(r.error);
      if (!r.dpop_token) return setError("The service did not return a session phrase. Try again.");
      // Remembered for the field only. The identity is written by `finish()`,
      // once the human has answered the DM.
      setLastTypedNpub(trimmed);
      setPendingProof(r.dpop_token);
      setStage("awaiting");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError("");
    setStage("checking");
    try {
      const r = await receiveNpubProof(trimmed, pendingProof);
      if (r.error) {
        setError(r.error);
        setStage("awaiting");
        return;
      }
      const token = r.dpop_token || pendingProof;
      const npub = r.proven_npub || trimmed;
      setStoredNpub(npub);
      setStoredProof(token);
      if (r.expires_in_seconds && r.expires_in_seconds > 0) {
        recordRecentLogin(npub, token, r.expires_in_seconds);
        const h = Math.floor(r.expires_in_seconds / 3600);
        setNote(`Proof cached for ~${h > 0 ? `${h}h` : `${Math.round(r.expires_in_seconds / 60)}m`}.`);
      }
      onLogin();
    } catch (e) {
      setError(`Verification failed: ${(e as Error).message}`);
      setStage("awaiting");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage("begin");
    setPendingProof("");
    setError("");
  }

  return (
    <div className={cx("max-w-md mx-auto mt-12 px-4", c.root)}>
      <h1 className="text-xl font-semibold mb-1">Sign in to {appName}</h1>
      {welcome && <div className={cx("text-sm mb-3", c.welcome)}>{welcome}</div>}
      <p className={cx(`text-sm mb-5 ${muted}`, c.register)}>
        {appName} is an operator on the Tollbooth DPYC™ network. DPYC™ — Don't Pester Your Customer™: no email, no
        password, no KYC. Your Nostr key is your identity.
      </p>

      {notice && <div className={`mb-5 ${warnBox}`}>{notice}</div>}

      {stage === "begin" && recents.length > 0 && (
        <div className="mb-5">
          <div className={`text-xs uppercase tracking-wider mb-2 ${muted}`}>Recent identities</div>
          <div className="space-y-1.5">
            {recents.map((e) => (
              <div key={e.npub} className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => reuseRecent(e)}
                  disabled={busy}
                  title={`Re-enter as ${e.npub} on the cached proof`}
                  className={`${card} flex-1 flex items-center justify-between px-3 py-2.5 text-left hover:border-[var(--tb-accent)]`}
                >
                  <span className="font-mono text-xs truncate">{e.npub.slice(0, 12)}…{e.npub.slice(-6)}</span>
                  <span className={`text-xs shrink-0 ml-2 ${muted}`}>{ttl(e.expiresAt)} left</span>
                </button>
                <button
                  type="button"
                  onClick={() => forget(e.npub)}
                  disabled={busy}
                  title="Forget this identity"
                  aria-label="Forget this identity"
                  className={`w-9 rounded-lg border border-[var(--tb-line)] ${muted}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`${card} p-4 space-y-3`}>
        {stage === "begin" ? (
          <>
            <label className={`block text-xs uppercase tracking-wider ${muted}`} htmlFor="tb-npub-field">
              Paste your npub or nsec
            </label>
            <input
              id="tb-npub-field"
              type={isNsec ? "password" : "text"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setGeneratedHint(false);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !valid || busy) return;
                if (isNsec) signInWithNsec();
                else void begin();
              }}
              placeholder="npub1… (a message to your client) or nsec1… (instant)"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className={input}
            />
            {generatedHint && (
              <div className={warnBox}>
                New key generated. <b>Save this nsec</b> somewhere safe — it's the only copy and it lives only in this browser.
              </div>
            )}
            <button
              type="button"
              onClick={() => (isNsec ? signInWithNsec() : void begin())}
              disabled={!valid || busy}
              className={primary}
            >
              {busy ? "Sending…" : isNpub ? "Send message" : "Sign in"}
            </button>
            <p className={`text-xs ${muted}`}>
              {isNsec
                ? "Your nsec stays in this browser and signs each call."
                : "We send a message to your npub. Approve it from your Nostr client — your signature is the proof."}
            </p>
            <button type="button" onClick={generateKey} className={ghost}>
              Generate a new key
            </button>
          </>
        ) : (
          <>
            <div className={`${warnBox} space-y-1.5`}>
              <div className="font-medium">Message sent — open your Nostr client.</div>
              <div>Reply with any text. Your signature on that reply is the proof.</div>
              {operatorHash && (
                <div>
                  Sender fingerprint: <span className="font-mono">🔒 {operatorHash}</span>
                </div>
              )}
            </div>
            {pendingProof && (
              <div className="rounded-lg p-3 text-xs border border-[var(--tb-accent)] space-y-2">
                <div className={`uppercase tracking-wider text-[10px] ${muted}`}>Confirmation code</div>
                <div className="font-mono text-base select-all">{pendingProof}</div>
                <div className={`leading-relaxed ${muted}`}>
                  The same code appears in the message. <b>Approve it only if the codes match.</b> If they differ — or
                  the message points you somewhere other than this site — do not reply.
                </div>
              </div>
            )}
            <button type="button" onClick={() => void finish()} disabled={busy} className={primary}>
              {busy ? "Checking…" : "I've replied — verify"}
            </button>
            <button type="button" onClick={() => void begin()} disabled={busy} className={ghost}>
              Resend
            </button>
            <button type="button" onClick={reset} disabled={busy} className={`w-full text-xs py-1.5 ${muted}`}>
              Use a different npub
            </button>
          </>
        )}

        {error && <Trouble raw={error} appName={appName} />}
        {note && <div className={`text-xs text-center italic ${muted}`}>{note}</div>}
      </div>

      {steps && <SignInSteps stage={gateStage(stage, busy)} classNames={{ ...STEPS_LOOK, ...c.steps }} />}
      {links && <SignInLinks credit={linksCredit} classNames={{ ...LINKS_LOOK, ...c.links }} />}
    </div>
  );
}

/** A failure, read to the person: the lead first, the service's own words underneath. */
function Trouble({ raw, appName }: { raw: string; appName: string }) {
  const s = readSignInFailure(raw, appName);
  return (
    <div className={s.retryable ? warnBox : errBox}>
      {s.lead}
      {s.detail && <div className="mt-2 font-mono text-[10px] leading-relaxed opacity-70">{s.detail}</div>}
    </div>
  );
}

function ttl(expiresAt: number): string {
  const min = Math.max(0, Math.floor((expiresAt - Date.now()) / 60000));
  const hr = Math.floor(min / 60);
  return hr >= 1 ? `${hr}h ${min % 60}m` : `${min}m`;
}
