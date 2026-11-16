/**
 * The package's own translations, one module per language, each fetched only
 * when a reader chooses it.
 *
 * To add a language, a translator creates `locales/<code>.ts`:
 *
 *     import type { Translation } from "../types.ts";
 *     const fr: Translation = { "signin.send": "Envoyer", … };
 *     export default fr;
 *
 * and adds its line here, e.g. `fr: () => import("./locales/fr.ts"),`. The
 * specifier is written out so that every bundler splits the file into its own
 * chunk. `locales.test.ts` fails when a file has no line here, a key English
 * lacks, a key missing, or a `{{placeholder}}` that differs.
 */

import type { LanguageCode } from "./languages.ts";
import type { Translation } from "./types.ts";

export const LOCALE_LOADERS: Partial<Record<LanguageCode, () => Promise<{ default: Translation }>>> = {};
