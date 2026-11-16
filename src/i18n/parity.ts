/**
 * What a translation must share with English: the same keys (give or take the
 * plural forms its language has), the same `{{placeholders}}` and the same
 * `<tags>`. Pure, so the rule is tested with made-up words.
 */

const PLURAL = /_(zero|one|two|few|many|other)$/;

/** The `{{names}}` a string is filled from, sorted. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1]))].sort();
}

/** The `<tags>` a string asks `Tx` to draw, sorted. */
export function tags(text: string): string[] {
  return [...new Set([...text.matchAll(/<(\w+)\s*\/?>/g)].map((m) => m[1]))].sort();
}

/** The keys that vary with a count: those English spells with `_other`. */
export function pluralBases(english: Record<string, string>): Set<string> {
  return new Set(Object.keys(english).filter((k) => k.endsWith("_other")).map((k) => k.slice(0, -"_other".length)));
}

/** A key as code asks for it. */
export function baseKey(key: string, plurals: ReadonlySet<string>): string {
  const base = key.replace(PLURAL, "");
  return plurals.has(base) ? base : key;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Everything wrong with `locale` against `english`; empty when it is sound. */
export function localeProblems(english: Record<string, string>, locale: Record<string, unknown>): string[] {
  const out: string[] = [];
  const plurals = pluralBases(english);
  const wanted = new Set(Object.keys(english).map((k) => baseKey(k, plurals)));
  const got = new Set(Object.keys(locale).map((k) => baseKey(k, plurals)));

  for (const k of wanted) if (!got.has(k)) out.push(`missing: ${k}`);
  for (const k of got) if (!wanted.has(k)) out.push(`not in English: ${k}`);
  for (const base of plurals) {
    if (got.has(base) && !(`${base}_other` in locale)) out.push(`needs ${base}_other`);
  }

  for (const [key, value] of Object.entries(locale)) {
    if (typeof value !== "string" || !value.trim()) {
      out.push(`empty: ${key}`);
      continue;
    }
    const base = baseKey(key, plurals);
    if (!wanted.has(base)) continue;
    // A plural form is held to English's `_other`, the form that names every variable.
    const source = english[plurals.has(base) ? `${base}_other` : key];
    if (source === undefined) continue;
    const allowed = placeholders(source);
    const used = placeholders(value);
    const fits = plurals.has(base) && !key.endsWith("_other") ? used.every((p) => allowed.includes(p)) : same(used, allowed);
    if (!fits) out.push(`placeholders differ: ${key} has {{${used.join("}}, {{")}}}, English has {{${allowed.join("}}, {{")}}}`);
    if (!same(tags(value), tags(source))) out.push(`tags differ: ${key}`);
  }
  return out;
}
