/**
 * The reader's text size as a row of chips, each an "A" a step larger, the
 * current one marked. Kept under `<prefix>:text-size` and applied at once.
 * Mechanics only: `classNames` styles it.
 */

import { useState } from "react";
import { tollboothConfig } from "../config.ts";
import {
  TEXT_SCALE, TEXT_SIZE_NAMES, TEXT_SIZES, applyTextSize, readTextSize, writeTextSize, type TextSize,
} from "../textSize.ts";

export interface TextSizeToggleClassNames {
  root?: string;
  chip?: string;
  /** Added to the chip of the current pick. */
  active?: string;
}

export default function TextSizeToggle({ classNames: c = {} }: { classNames?: TextSizeToggleClassNames }) {
  const prefix = tollboothConfig().storagePrefix;
  const [size, setSize] = useState<TextSize>(() => readTextSize(prefix));
  const choose = (next: TextSize) => {
    writeTextSize(prefix, next);
    applyTextSize(next);
    setSize(next);
  };
  return (
    <div role="radiogroup" aria-label="Text size" className={c.root}>
      {TEXT_SIZES.map((s) => {
        const on = s === size;
        return (
          <button key={s} type="button" role="radio" aria-checked={on} aria-label={TEXT_SIZE_NAMES[s]}
            title={TEXT_SIZE_NAMES[s]} onClick={() => choose(s)}
            className={[c.chip, on && c.active].filter(Boolean).join(" ") || undefined}>
            <span aria-hidden style={{ fontSize: `${0.8 * TEXT_SCALE[s]}em`, fontWeight: 600 }}>A</span>
          </button>
        );
      })}
    </div>
  );
}
