/**
 * The patron's Nostr kind-0 profile — the self-sovereign home of their name
 * and avatar. Edits publish a new signed kind-0, visible in every Nostr client.
 * Without a signer the fields are read-only and the action explains why.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, X } from "lucide-react";
import { avatarFor, isAvatarUrl, setStoredAvatar, shortNpub } from "../avatar.ts";
import { tollboothConfig } from "../config.ts";
import { canSignProfile, fetchProfile, publishProfile } from "../nostrProfile.ts";
import {
  collapsedDisplayName,
  howToSetExplainer,
  publishControlDisabled,
  publishControlLabel,
  publishControlMode,
} from "../profilePresentation.ts";
import type { Kind0 } from "../standardTools.ts";
import Avatar from "./Avatar.tsx";
import AvatarPicker from "./AvatarPicker.tsx";
import { card, input, muted } from "./ui.ts";

const FIELDS: { key: keyof Kind0; label: string; placeholder: string }[] = [
  { key: "display_name", label: "Display name", placeholder: "Satoshi" },
  { key: "lud16", label: "Lightning address (lud16)", placeholder: "you@walletofsatoshi.com" },
  { key: "nip05", label: "NIP-05", placeholder: "name@domain.com" },
  { key: "website", label: "Website", placeholder: "https://…" },
  { key: "about", label: "About", placeholder: "A short bio…" },
];

export default function NostrProfilePanel({ npub }: { npub: string }) {
  const { appName } = tollboothConfig();
  const [profile, setProfile] = useState<Kind0>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fieldsId = useId();
  const explainerId = useId();
  const howToRef = useRef<HTMLDivElement | null>(null);
  const mode = publishControlMode(canSignProfile());
  const explainer = howToSetExplainer(appName);

  useEffect(() => {
    let live = true;
    // A new npub starts empty, so no field of the last patron's survives
    // into theirs while the relays are read.
    setProfile({});
    setLoading(true);
    fetchProfile(npub)
      .then((p) => {
        if (!live || !p) return;
        setProfile({ ...p, display_name: p.display_name || p.name || "" });
        if (p.picture) setStoredAvatar(npub, p.picture);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [npub]);

  // Dismiss on outside tap or Escape — touch friendly, no hover.
  useEffect(() => {
    if (!showHowTo) return;
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && !howToRef.current?.contains(e.target)) setShowHowTo(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowHowTo(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [showHowTo]);

  const set = (k: keyof Kind0, v: string) => setProfile((p) => ({ ...p, [k]: v }));

  function pickAvatar(v: string) {
    set("picture", v);
    setStoredAvatar(npub, v);
  }

  function copyNpub() {
    navigator.clipboard?.writeText(npub).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  async function publish() {
    setPublishing(true);
    setMsg(null);
    const picture = profile.picture ?? "";
    const glyph = picture !== "" && !isAvatarUrl(picture);
    try {
      const r = await publishProfile(npub, {
        ...profile,
        name: profile.display_name,
        // kind-0 picture is a URL; a glyph stays local to this site.
        picture: glyph ? "" : picture,
      });
      const tail = glyph ? " (Emoji avatar kept local — a Nostr picture must be a URL.)" : "";
      if (r.error) setMsg({ ok: false, text: r.error });
      else if ((r.ok ?? 0) > 0) setMsg({ ok: true, text: `Published to ${r.ok}/${r.total} relays.${tail}` });
      else setMsg({ ok: false, text: `No relay accepted the event.${tail}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className={`${card} px-4 py-3`}>
      <div className="flex items-start gap-3">
        <div className="relative flex-none">
          <Avatar value={profile.picture || avatarFor(npub)} size={56} />
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              setShowPicker((v) => !v);
            }}
            aria-label={showPicker ? "Done changing avatar" : "Change avatar"}
            aria-expanded={showPicker}
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--tb-line)] bg-[var(--tb-surface)] shadow-sm"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium truncate">{collapsedDisplayName(profile.display_name ?? "")}</div>
            {mode === "how-to-set" && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md bg-[var(--tb-surface-2)] ${muted}`}>Read-only</span>
            )}
          </div>
          <button type="button" onClick={copyNpub} title="Copy full npub" className={`mt-0.5 font-mono text-xs ${muted}`}>
            {copied ? "Copied" : shortNpub(npub)}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={fieldsId}
          className="flex-none inline-flex items-center gap-1 rounded-full border border-[var(--tb-line)] px-2.5 py-1.5 text-xs"
        >
          {expanded ? "Hide" : "Edit"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      {showPicker && (
        <div className="mt-3">
          <AvatarPicker value={profile.picture ?? ""} onChange={pickAvatar} />
        </div>
      )}

      {loading ? (
        <div className={`flex items-center gap-1.5 text-xs py-2 mt-3 ${muted}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading from relays…
        </div>
      ) : (
        <div id={fieldsId} hidden={!expanded} className={expanded ? "mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2" : undefined}>
          {FIELDS.map((f) => (
            <label key={f.key} className={`block text-xs ${muted} ${f.key === "about" ? "sm:col-span-2" : ""}`}>
              {f.label}
              {f.key === "about" ? (
                <textarea
                  value={profile[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={2}
                  className={`mt-1 ${input} font-sans resize-none`}
                  placeholder={f.placeholder}
                  readOnly={mode === "how-to-set"}
                />
              ) : (
                <input
                  value={profile[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  className={`mt-1 ${input} font-sans`}
                  placeholder={f.placeholder}
                  readOnly={mode === "how-to-set"}
                />
              )}
            </label>
          ))}

          {msg && (
            <div className={`text-xs sm:col-span-2 ${msg.ok ? "text-[var(--tb-ok)]" : "text-[var(--tb-err-ink)]"}`}>{msg.text}</div>
          )}

          <div className="relative flex items-center gap-3 sm:col-span-2" ref={howToRef}>
            <button
              type="button"
              onClick={() => (mode === "how-to-set" ? setShowHowTo((v) => !v) : void publish())}
              disabled={publishControlDisabled(mode, publishing)}
              aria-haspopup={mode === "how-to-set" ? "dialog" : undefined}
              aria-expanded={mode === "how-to-set" ? showHowTo : undefined}
              className={
                mode === "publish"
                  ? "rounded-full bg-[var(--tb-accent)] px-4 py-2 text-sm font-medium text-[var(--tb-on-accent)] disabled:opacity-40"
                  : "rounded-full border border-[var(--tb-line)] px-4 py-2 text-sm"
              }
            >
              {publishControlLabel(mode, publishing)}
            </button>

            {showHowTo && mode === "how-to-set" && (
              <div
                role="dialog"
                aria-modal="false"
                aria-labelledby={explainerId}
                className={`${card} absolute left-0 bottom-full z-20 mb-2 w-[min(100%,22rem)] p-3 shadow-lg`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div id={explainerId} className="text-sm font-medium">{explainer.title}</div>
                  <button type="button" onClick={() => setShowHowTo(false)} aria-label="Close" className={muted}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className={`space-y-2 text-xs leading-relaxed ${muted}`}>
                  {explainer.paragraphs.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
