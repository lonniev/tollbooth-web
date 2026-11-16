/**
 * The reader's language as a row of buttons, each in the language's own name,
 * the current one pressed. The choice is kept on this device and every screen
 * the package draws follows it, as does a site's own text read through `useT`.
 *
 * Styled by theme.css (`tb-lang`, `tb-lang-chip`, `tb-lang-on`); `classNames`
 * replaces any of the three.
 */

import { cx } from "./cx.ts";
import { useLanguage } from "./useLanguage.ts";
import { useT } from "./useT.ts";

export interface LanguageChooserClassNames {
  root?: string;
  chip?: string;
  /** Added to the chip of the current language. */
  active?: string;
}

export interface LanguageChooserProps {
  classNames?: LanguageChooserClassNames;
}

export default function LanguageChooser({ classNames: c = {} }: LanguageChooserProps) {
  const { language, setLanguage, languages } = useLanguage();
  const t = useT();
  return (
    <div role="group" aria-label={t("language.label")} className={c.root ?? "tb-lang"}>
      {languages.map((l) => {
        const on = l.code === language;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={on}
            onClick={() => void setLanguage(l.code)}
            className={cx(c.chip ?? "tb-lang-chip", on && (c.active ?? "tb-lang-on"))}
          >
            {l.name}
          </button>
        );
      })}
    </div>
  );
}
