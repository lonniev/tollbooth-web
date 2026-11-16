/**
 * A sentence with elements inside it, kept whole for the translator:
 *
 *     English:  Paste your <b>npub</b> here, {{name}}.
 *     Drawn by: <Tx k={thatKey} vars={{ name }} components={{ b: <strong /> }} />
 *
 * Each `<tag>` in the string is drawn with `components.tag`, so a language may
 * move the element to where its grammar wants it. A site draws its own words
 * with `ns`, as `<Tx ns="mysite" k={key} components={{ link: <a href="/more" /> }} />`.
 */

import type { ReactElement } from "react";
import { Trans } from "react-i18next";
import { i18n, TOLLBOOTH_NAMESPACE, type TranslationKey, type Vars } from "../i18n/index.ts";
import { useT } from "./useT.ts";

export type TxProps =
  | { ns?: undefined; k: TranslationKey; vars?: Vars; components?: Record<string, ReactElement> }
  | { ns: string; k: string; vars?: Vars; components?: Record<string, ReactElement> };

export default function Tx({ ns = TOLLBOOTH_NAMESPACE, k, vars, components }: TxProps) {
  useT(ns); // re-render when the language changes or the words arrive
  return <Trans i18n={i18n} ns={ns} i18nKey={k as string} values={vars} components={components} />;
}
