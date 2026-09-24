/**
 * Avatar chooser: a paged Iconify catalog, the glyph palette, and a custom
 * URL or glyph. Iconify (api.iconify.design) is a free public endpoint; each
 * SVG loads lazily per tile and nothing is bundled.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { avatarChoices } from "../avatar.ts";
import Avatar from "./Avatar.tsx";
import { errBox, input, muted } from "./ui.ts";

const COLLECTIONS = [
  { prefix: "fluent-emoji-flat", label: "Fluent — Microsoft, flat" },
  { prefix: "twemoji", label: "Twemoji — Twitter's set" },
  { prefix: "noto", label: "Noto — Google" },
  { prefix: "openmoji", label: "OpenMoji — CC-BY-SA" },
  { prefix: "emojione-v1", label: "EmojiOne — classic" },
] as const;
const PAGE_SIZE = 30;

const iconUrl = (prefix: string, name: string) => `https://api.iconify.design/${prefix}/${name}.svg`;

const tile = (selected: boolean) =>
  `flex items-center justify-center aspect-square rounded-md p-1 border transition-colors ${
    selected
      ? "border-[var(--tb-accent)] bg-[var(--tb-surface-2)]"
      : "border-[var(--tb-line)] hover:border-[var(--tb-accent)]"
  }`;

export default function AvatarPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [tab, setTab] = useState<"catalog" | "glyphs">("catalog");
  const [collection, setCollection] = useState<string>(COLLECTIONS[0].prefix);
  const [names, setNames] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setNames([]);
    setPage(0);
    fetch(`https://api.iconify.design/collection?prefix=${collection}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Iconify returned ${r.status}`);
        return r.json();
      })
      .then((data: { uncategorized?: string[]; categories?: Record<string, string[]> }) => {
        if (!alive) return;
        const out: string[] = [];
        for (const list of Object.values(data.categories ?? {})) out.push(...list);
        out.push(...(data.uncategorized ?? []));
        setNames(out);
      })
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [collection]);

  const totalPages = Math.max(1, Math.ceil(names.length / PAGE_SIZE));
  const visible = names.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex gap-2 mb-3 text-xs">
        {(["catalog", "glyphs"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full transition-colors ${
              tab === t ? "bg-[var(--tb-accent)] text-[var(--tb-on-accent)]" : `${muted} hover:bg-[var(--tb-surface-2)]`
            }`}
          >
            {t === "catalog" ? "Catalog" : "Glyphs"}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <select value={collection} onChange={(e) => setCollection(e.target.value)} className={`${input} py-1.5 text-xs font-sans`}>
              {COLLECTIONS.map((c) => (
                <option key={c.prefix} value={c.prefix}>{c.label}</option>
              ))}
            </select>
            {!loading && !error && names.length > 0 && (
              <span className={`text-xs whitespace-nowrap ${muted}`}>{page + 1}/{totalPages}</span>
            )}
          </div>

          {loading && (
            <p className={`flex items-center justify-center gap-1.5 py-6 text-xs ${muted}`}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading catalog…
            </p>
          )}
          {error && <div className={errBox}>Couldn't reach Iconify: {error}</div>}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-10 gap-1.5">
                {visible.map((name) => {
                  const url = iconUrl(collection, name);
                  return (
                    <button key={name} type="button" onClick={() => onChange(url)} title={name.replace(/-/g, " ")} className={tile(value === url)}>
                      <img src={url} alt={name} loading="lazy" className="h-full w-full object-contain" />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-3 mt-3 text-xs">
                <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded-full border border-[var(--tb-line)] disabled:opacity-30">← Prev</button>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded-full border border-[var(--tb-line)] disabled:opacity-30">Next →</button>
              </div>
            </>
          )}
        </>
      )}

      {tab === "glyphs" && (
        <div className="grid grid-cols-10 gap-1.5">
          {avatarChoices().map((glyph) => (
            <button key={glyph} type="button" onClick={() => onChange(glyph)} className={`${tile(value === glyph)} text-lg`}>
              {glyph}
            </button>
          ))}
        </div>
      )}

      <details className="mt-3">
        <summary className={`text-xs uppercase tracking-wider cursor-pointer ${muted}`}>Custom (image URL or glyph)</summary>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… or a single emoji"
          className={`mt-2 ${input} py-1.5 text-xs`}
        />
      </details>

      {value && (
        <div className="mt-4 flex items-center gap-3">
          <Avatar value={value} size={48} />
          <span className={`text-xs ${muted}`}>Selected — applies immediately.</span>
        </div>
      )}
    </div>
  );
}
