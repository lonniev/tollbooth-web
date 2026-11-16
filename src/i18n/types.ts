import type { en } from "./en.ts";

/** The forms a count can take, as i18next names them (CLDR plural categories). */
export type PluralForm = "zero" | "one" | "two" | "few" | "many" | "other";

type StripPlural<K> = K extends `${infer Base}_${"one" | "other"}` ? Base : K;

/** A key as English spells it, plural suffix and all. */
export type EnglishKey = keyof typeof en;

/** A key as code asks for it: `usage.calls` stands for `usage.calls_one` / `usage.calls_other`. */
export type TranslationKey = StripPlural<EnglishKey>;

/** The keys that vary with a count. */
type PluralBase = EnglishKey extends infer K ? (K extends `${infer Base}_other` ? Base : never) : never;

/**
 * One language's words: every English key, plus the plural forms that language
 * has beyond English's two (French and Spanish add `_many`, for example).
 */
export type Translation = Record<EnglishKey, string> &
  Partial<Record<`${PluralBase}_${Exclude<PluralForm, "one" | "other">}`, string>>;

/** What a `{{name}}` in a string is filled from. `count` chooses the plural form. */
export type Vars = Record<string, string | number>;

/** A site's own words for one language: flat dotted keys to strings. */
export type Resource = Record<string, string>;
