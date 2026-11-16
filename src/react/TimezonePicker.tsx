/**
 * The display time zone as a select: "Automatic (<the browser's zone>)" and a
 * list of zones. Choosing one stores it under `<prefix>:timezone` and every
 * clock using `useTimezone` follows. Mechanics only — `classNames` styles it,
 * `autoLabel` / `optionLabel` word it, `options` picks the zones offered. A
 * stored zone that is not in `options` is still shown, so the select never
 * lies about the pick.
 */

import type { TranslationKey } from "../i18n/index.ts";
import { TIMEZONE_OPTIONS, detectBrowserTimeZone } from "../timezone.ts";
import { useT } from "./useT.ts";
import { useTimezone } from "./useTimezone.ts";

export interface TimezoneOption {
  value: string;
  label: string;
  /** The package's own word for `label`, shown in the reader's language. */
  labelKey?: TranslationKey;
}

export interface TimezonePickerClassNames {
  root?: string;
  label?: string;
  select?: string;
}

export interface TimezonePickerProps {
  /** The zones offered. Default `TIMEZONE_OPTIONS` (major cities and UTC). */
  options?: readonly TimezoneOption[];
  /** A visible label above the select; without one the select is labelled "Time zone". */
  label?: string;
  /** Text of the "auto" choice, given the browser's zone. Default "Automatic (<zone>)". */
  autoLabel?: (detected: string) => string;
  /** Text of each zone. Default its label. */
  optionLabel?: (option: TimezoneOption) => string;
  id?: string;
  classNames?: TimezonePickerClassNames;
}

export default function TimezonePicker({
  options = TIMEZONE_OPTIONS,
  label,
  autoLabel: autoLabelProp,
  optionLabel: optionLabelProp,
  id = "tb-timezone",
  classNames: c = {},
}: TimezonePickerProps) {
  const t = useT();
  const [pref, , setPref] = useTimezone();
  const autoLabel = autoLabelProp ?? ((detected: string) => t("timezone.automatic", { zone: detected }));
  const optionLabel = optionLabelProp ?? ((o: TimezoneOption) => (o.labelKey ? t(o.labelKey) : o.label));
  const listed = pref === "auto" || options.some((o) => o.value === pref);
  const shown: readonly TimezoneOption[] = listed ? options : [...options, { value: pref, label: pref }];
  return (
    <div className={c.root}>
      {label && (
        <label htmlFor={id} className={c.label}>
          {label}
        </label>
      )}
      <select
        id={id}
        value={pref}
        onChange={(e) => setPref(e.target.value)}
        aria-label={label ? undefined : t("timezone.label")}
        className={c.select}
      >
        <option value="auto">{autoLabel(detectBrowserTimeZone())}</option>
        {shown.map((o) => (
          <option key={o.value} value={o.value}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
