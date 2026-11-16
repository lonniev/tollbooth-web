/**
 * The reader's text size as a row of chips, each an "A" a step larger, the
 * current one marked. Kept under `<prefix>:text-size` and applied at once.
 * Mechanics only: `classNames` styles it.
 */

import { useState } from "react";
import { tollboothConfig } from "../config.ts";
import type { TranslationKey } from "../i18n/index.ts";
import {
  TEXT_SCALE, TEXT_SIZES, applyTextSize, readTextSize, writeTextSize, type TextSize,
} from "../textSize.ts";
import { useT } from "./useT.ts";

const NAME_KEYS: Record<TextSize, TranslationKey> = {
  standard: "textSize.standard",
  large: "textSize.large",
  larger: "textSize.larger",
  largest: "textSize.largest",
};

export interface TextSizeToggleClassNames {
  root?: string;
  chip?: string;
  /** Added to the chip of the current pick. */
  active?: string;
}

export default function TextSizeToggle({ classNames: c = {} }: { classNames?: TextSizeToggleClassNames }) {
  const t = useT();
  const prefix = tollboothConfig().storagePrefix;
  const [size, setSize] = useState<TextSize>(() => readTextSize(prefix));
  const choose = (next: TextSize) => {
    writeTextSize(prefix, next);
    applyTextSize(next);
    setSize(next);
  };
  return (
    <div role="radiogroup" aria-label={t("textSize.label")} className={c.root}>
      {TEXT_SIZES.map((s) => {
        const on = s === size;
        return (
          <button key={s} type="button" role="radio" aria-checked={on} aria-label={t(NAME_KEYS[s])}
            title={t(NAME_KEYS[s])} onClick={() => choose(s)}
            className={[c.chip, on && c.active].filter(Boolean).join(" ") || undefined}>
            <span aria-hidden style={{ fontSize: `${0.8 * TEXT_SCALE[s]}em`, fontWeight: 600 }}>A</span>
          </button>
        );
      })}
    </div>
  );
}
