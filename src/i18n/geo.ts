/**
 * A guest's first language, from where they are. Pure but for `guestCountry`,
 * which asks the site's own Cloudflare edge: every Pages site answers
 * `/cdn-cgi/trace` with the visitor's country (`loc=FR`), so no other company
 * sees the visit and no key is needed.
 */

import { DEFAULT_LANGUAGE, isLanguage, type LanguageCode } from "./languages.ts";

/**
 * The countries where one of the six languages is spoken, the main one first.
 * A country with one is shown in it. A country with several lets the browser's
 * language choose among them. Every other country is shown in English.
 */
export const COUNTRY_LANGUAGES: Readonly<Record<string, readonly LanguageCode[]>> = {
  // English and another of ours
  US: ["en", "es"],
  CA: ["en", "fr"],
  IN: ["hi", "en"],
  SG: ["en", "zh"],
  BE: ["en", "fr"],
  CH: ["en", "fr"],
  LU: ["fr", "en"],
  // French
  FR: ["fr"], MC: ["fr"], HT: ["fr"], SN: ["fr"], CI: ["fr"], CM: ["fr", "en"], CD: ["fr"], CG: ["fr"],
  ML: ["fr"], BF: ["fr"], NE: ["fr"], TD: ["fr"], GN: ["fr"], BJ: ["fr"], TG: ["fr"], GA: ["fr"],
  MG: ["fr"], RW: ["fr", "en"], BI: ["fr"], DJ: ["fr"], KM: ["fr"], CF: ["fr"], PF: ["fr"], NC: ["fr"],
  RE: ["fr"], GP: ["fr"], MQ: ["fr"], GF: ["fr"], YT: ["fr"], PM: ["fr"], WF: ["fr"], BL: ["fr"], MF: ["fr"],
  // Spanish
  ES: ["es"], MX: ["es"], AR: ["es"], CO: ["es"], PE: ["es"], VE: ["es"], CL: ["es"], EC: ["es"],
  GT: ["es"], CU: ["es"], BO: ["es"], DO: ["es"], HN: ["es"], PY: ["es"], SV: ["es"], NI: ["es"],
  CR: ["es"], PA: ["es"], UY: ["es"], PR: ["es", "en"], GQ: ["es"],
  // Japanese
  JP: ["ja"],
  // Chinese
  CN: ["zh"], TW: ["zh"], HK: ["zh", "en"], MO: ["zh"],
};

/** The language of a BCP 47 tag: "fr-CA" is "fr". */
const baseOf = (tag: string): string => tag.trim().toLowerCase().split(/[-_]/, 1)[0];

/**
 * The first language for a guest in `country` whose browser asks for
 * `preferred`. English when the country is unknown or speaks none of ours.
 */
export function languageForCountry(
  country: string | null | undefined,
  preferred: readonly string[] | null | undefined,
): LanguageCode {
  const spoken = typeof country === "string" ? COUNTRY_LANGUAGES[country.trim().toUpperCase()] : undefined;
  if (!spoken?.length) return DEFAULT_LANGUAGE;
  if (spoken.length > 1) {
    for (const tag of preferred ?? []) {
      if (typeof tag !== "string") continue;
      const base = baseOf(tag);
      if (isLanguage(base) && spoken.includes(base)) return base;
    }
  }
  return spoken[0];
}

/** The two-letter country in a `/cdn-cgi/trace` answer, or null. */
export function countryFromTrace(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const m = /^loc=([A-Z]{2})$/m.exec(text);
  return m && m[1] !== "XX" && m[1] !== "T1" ? m[1] : null;
}

const TRACE_TIMEOUT_MS = 1500;

/** The guest's country as the site's edge sees it, or null off Cloudflare, offline or slow. */
export async function guestCountry(): Promise<string | null> {
  const origin = globalThis.location?.origin;
  if (!origin || !/^https?:/.test(origin)) return null;
  try {
    const res = await fetch(`${origin}/cdn-cgi/trace`, { signal: AbortSignal.timeout(TRACE_TIMEOUT_MS) });
    return res.ok ? countryFromTrace(await res.text()) : null;
  } catch {
    return null;
  }
}
