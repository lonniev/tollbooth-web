/**
 * Asking for an npub, helpfully: a typed or pasted key is checked as it is
 * entered and becomes a chiclet with the person's Nostr name, picture and
 * NIP-05 address (✓ when the address names this very key), a copy button and
 * Remove. `NpubField` holds one npub, `NpubListField` many.
 *
 * Laid out by `theme.css` (`.tb-npub-*`), so every site's npub looks the same.
 */

import { useEffect, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { BadgeCheck, Check, Copy, UserPlus, X } from "lucide-react";

import { shortNpub } from "../avatar.ts";
import { npubCard, npubFromInput, npubHue, npubsFromText, resolveNip05, withNpubs, type NpubCard } from "../npubInput.ts";
import { nip19 } from "nostr-tools";
import { useT } from "./useT.ts";

function useCard(npub: string): NpubCard | null {
  const [card, setCard] = useState<NpubCard | null>(null);
  useEffect(() => {
    let live = true;
    setCard(null);
    npubCard(npub).then((c) => live && setCard(c), () => {});
    return () => { live = false; };
  }, [npub]);
  return card;
}

/** One npub as a chiclet: its colour, picture and name, the short npub, NIP-05, copy and (optionally) Remove. */
export function NpubChip({ npub, onRemove }: { npub: string; onRemove?: () => void }) {
  const t = useT();
  const card = useCard(npub);
  const [copied, setCopied] = useState(false);
  const name = card?.name || shortNpub(npub);
  const hue = npubHue(npub);

  async function copy() {
    await navigator.clipboard?.writeText(npub);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span className="tb-npub-chip" title={npub} style={{ ["--tb-npub-hue" as string]: String(hue) }}>
      <span className="tb-npub-badge" aria-hidden>
        {card?.picture ? <img src={card.picture} alt="" loading="lazy" referrerPolicy="no-referrer" /> : npub.slice(5, 7).toUpperCase()}
      </span>
      <span className="tb-npub-text">
        <span className="tb-npub-name">{name}</span>
        <span className="tb-npub-sub">
          {card?.name ? shortNpub(npub) : ""}
          {card?.nip05 && (
            <span className={card.verified ? "tb-npub-nip05 tb-npub-ok" : "tb-npub-nip05"} title={card.verified ? t("npub.verified", { address: card.nip05 }) : undefined}>
              {card.verified && <BadgeCheck size={14} aria-hidden />}
              {card.nip05}
            </span>
          )}
        </span>
      </span>
      <button type="button" className="tb-npub-act" onClick={() => void copy()} aria-label={t("npub.copy")} title={t("npub.copy")}>
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
      {onRemove && (
        <button type="button" className="tb-npub-act" onClick={onRemove} aria-label={t("npub.remove", { name })} title={t("npub.remove", { name })}>
          <X size={16} aria-hidden />
        </button>
      )}
    </span>
  );
}

interface Typing {
  text: string;
  problem: string;
  looking: string;
}

/** The typing box both fields share: reads what was entered, resolves an address, hands back npubs. */
function useTyping(onNpubs: (npubs: string[]) => boolean | void) {
  const t = useT();
  const [s, setS] = useState<Typing>({ text: "", problem: "", looking: "" });

  async function take(text: string) {
    const readings = npubsFromText(text);
    if (!readings.length) return;
    const found: string[] = [];
    for (const r of readings) {
      if ("npub" in r) found.push(r.npub);
      else if ("address" in r) {
        setS((x) => ({ ...x, looking: r.address, problem: "" }));
        const key = await resolveNip05(r.address);
        if (!key) return setS({ text, problem: t("npub.problem.noAddress", { address: r.address }), looking: "" });
        found.push(nip19.npubEncode(key));
      } else if (r.problem === "secret") {
        return setS({ text: "", problem: t("npub.problem.secret"), looking: "" });
      } else if (r.problem === "notNpub") {
        const word = text.split(/[\s,;]+/).find((w) => "problem" in npubFromInput(w)) ?? text;
        return setS({ text, problem: t("npub.problem.notNpub", { text: word.slice(0, 24) }), looking: "" });
      }
    }
    if (onNpubs(found) === false) return setS((x) => ({ ...x, looking: "" }));
    setS({ text: "", problem: "", looking: "" });
  }

  return {
    state: s,
    setText: (text: string) => setS({ text, problem: "", looking: "" }),
    setProblem: (problem: string) => setS((x) => ({ ...x, problem, looking: "" })),
    take,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        void take(s.text);
      }
    },
    onPaste: (e: ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text");
      if (!pasted.trim()) return;
      e.preventDefault();
      void take(`${s.text} ${pasted}`);
    },
  };
}

/** A site's own classes for the box and its buttons, so the field matches its forms. */
export interface NpubFieldLook {
  inputClassName?: string;
  buttonClassName?: string;
}

function TypingBox({ typing, label, placeholder, ownNpub, onMe, look }: {
  typing: ReturnType<typeof useTyping>;
  label: string;
  placeholder?: string;
  ownNpub?: string;
  onMe?: () => void;
  look?: NpubFieldLook;
}) {
  const t = useT();
  const { state } = typing;
  return (
    <>
      <span className="tb-npub-entry">
        <input className={look?.inputClassName ?? "tb-npub-input"} value={state.text} aria-label={label} placeholder={placeholder ?? t("npub.placeholder")}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => typing.setText(e.target.value)} onKeyDown={typing.onKeyDown} onPaste={typing.onPaste}
          onBlur={() => { if (state.text.trim()) void typing.take(state.text); }} />
        {state.text.trim() && (
          <button type="button" className={look?.buttonClassName ?? "tb-npub-btn"} onClick={() => void typing.take(state.text)}><UserPlus size={16} aria-hidden />{t("npub.add")}</button>
        )}
        {ownNpub && onMe && !state.text.trim() && (
          <button type="button" className={look?.buttonClassName ?? "tb-npub-btn"} onClick={onMe}><UserPlus size={16} aria-hidden />{t("npub.me")}</button>
        )}
      </span>
      {state.looking && <span className="tb-npub-note">{t("npub.looking", { address: state.looking })}</span>}
      {state.problem && <span className="tb-npub-problem" role="alert">{state.problem}</span>}
    </>
  );
}

/** One npub. Empty `value` shows the box; a set one shows its chiclet, with Remove to change it. */
export function NpubField({ value, onChange, label, placeholder, ownNpub, look }: {
  look?: NpubFieldLook;
  value: string;
  onChange: (npub: string) => void;
  label: string;
  placeholder?: string;
  /** The signed-in npub, offered as "Me". */
  ownNpub?: string;
}) {
  const typing = useTyping((npubs) => { if (npubs[0]) onChange(npubs[0]); });
  return (
    <span className="tb-npub-field">
      {value
        ? <NpubChip npub={value} onRemove={() => onChange("")} />
        : <TypingBox typing={typing} label={label} placeholder={placeholder} ownNpub={ownNpub} onMe={ownNpub ? () => onChange(ownNpub) : undefined} look={look} />}
    </span>
  );
}

/** Many npubs: paste a list or add them one by one; each appears once, as a chiclet. */
export function NpubListField({ value, onChange, label, placeholder, ownNpub, max, look }: {
  look?: NpubFieldLook;
  value: readonly string[];
  onChange: (npubs: string[]) => void;
  label: string;
  placeholder?: string;
  ownNpub?: string;
  max?: number;
}) {
  const t = useT();
  const typing = useTyping((npubs) => {
    const next = withNpubs(value, npubs);
    if (max && next.length > max) {
      typing.setProblem(t("npub.problem.tooMany", { max }));
      return false;
    }
    onChange(next);
  });
  const mine = ownNpub && !value.includes(ownNpub) ? () => onChange(withNpubs(value, [ownNpub])) : undefined;
  return (
    <span className="tb-npub-field">
      {value.length > 0 && (
        <span className="tb-npub-chips">
          {value.map((n) => <NpubChip key={n} npub={n} onRemove={() => onChange(value.filter((x) => x !== n))} />)}
        </span>
      )}
      <TypingBox typing={typing} label={label} placeholder={placeholder} ownNpub={mine ? ownNpub : undefined} onMe={mine} look={look} />
    </span>
  );
}
