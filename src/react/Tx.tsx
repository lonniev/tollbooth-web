/**
 * A sentence with elements inside it, kept whole for the translator:
 *
 *     "signin.paste": "Paste your <b>npub</b> here, {{name}}."
 *     <Tx k="signin.paste" vars={{ name }} components={{ b: <strong /> }} />
 *
 * Each `<tag>` in the string is drawn with `components.tag`, so a language may
 * move the element to where its grammar wants it. Package-internal.
 */

import type { ReactElement } from "react";
import { Trans } from "react-i18next";
import { i18n, TOLLBOOTH_NAMESPACE, type TranslationKey, type Vars } from "../i18n/index.ts";
import { useT } from "./useT.ts";

export interface TxProps {
  k: TranslationKey;
  vars?: Vars;
  components?: Record<string, ReactElement>;
}

export default function Tx({ k, vars, components }: TxProps) {
  useT(); // re-render when the language changes
  return <Trans i18n={i18n} ns={TOLLBOOTH_NAMESPACE} i18nKey={k} values={vars} components={components} />;
}
