/**
 * The Profile page every site composed for itself, in one order for all of
 * them: Nostr profile, session key, usage, time zone, theme, coupons, build.
 *
 * Each section is on by default; `false` turns it off and an object passes it
 * its own props (headings, words, `classNames`). A site's own panels go in
 * `before`, `after`, or `between` — `between.sessionKey` is drawn right after
 * the session key, and keeps that place even when the section is off (a site
 * with its own coupons turns `coupons` off and puts them in `between.coupons`).
 *
 * Mechanics only: the time zone and theme controls sit in a `<section>` with a
 * heading and a line of intro (`classNames.section` …); every other panel draws
 * itself. Log out is a chip at the end when `onSignOut` is given.
 */

import { Fragment, type ReactNode } from "react";
import type { Kind0 } from "../standardTools.ts";
import type { TimezonePref } from "../timezone.ts";
import { accountSteps, type AccountSection } from "./accountSections.ts";
import BuildInfoPanel, { type BuildInfoPanelProps } from "./BuildInfoPanel.tsx";
import CouponsPanel, { type CouponsPanelProps } from "./CouponsPanel.tsx";
import NostrProfilePanel from "./NostrProfilePanel.tsx";
import SessionKeyClaim, { type SessionKeyClaimProps } from "./SessionKeyClaim.tsx";
import ThemeToggle, { type ThemeToggleProps } from "./ThemeToggle.tsx";
import TimezonePicker, { type TimezonePickerProps } from "./TimezonePicker.tsx";
import UsageSummary, { type UsageSummaryProps } from "./UsageSummary.tsx";
import { useTimezone } from "./useTimezone.ts";

export interface AccountSectionText {
  heading?: ReactNode;
  intro?: ReactNode;
}

export interface AccountTimezoneProps extends TimezonePickerProps, AccountSectionText {
  /** A line under the picker, given the stored pick and the zone it resolves to now. */
  note?: (pref: TimezonePref, zone: string) => ReactNode;
}

export interface AccountThemeProps extends ThemeToggleProps, AccountSectionText {}

export interface AccountPageClassNames {
  root?: string;
  heading?: string;
  /** The time-zone and theme sections: box, heading, intro, note. */
  section?: string;
  sectionHeading?: string;
  sectionIntro?: string;
  sectionNote?: string;
  /** The row holding Log out, and the chip. */
  actions?: string;
  signOut?: string;
}

export interface AccountPageProps {
  npub: string;
  /** Default "Profile"; null for none. */
  heading?: ReactNode;
  profile?: boolean | { onPublished?: (profile: Kind0) => void };
  sessionKey?: boolean | Omit<SessionKeyClaimProps, "npub">;
  usage?: boolean | UsageSummaryProps;
  timezone?: boolean | AccountTimezoneProps;
  theme?: boolean | AccountThemeProps;
  coupons?: boolean | CouponsPanelProps;
  build?: boolean | BuildInfoPanelProps;
  before?: ReactNode;
  /** A site's panel after the named section. */
  between?: Partial<Record<AccountSection, ReactNode>>;
  after?: ReactNode;
  onSignOut?: () => void;
  /** Default "Log out". */
  signOutLabel?: ReactNode;
  classNames?: AccountPageClassNames;
}

const opts = <T extends object>(v: boolean | T | undefined): T => (typeof v === "object" ? v : ({} as T));

export default function AccountPage({
  npub,
  heading = "Profile",
  profile,
  sessionKey,
  usage,
  timezone,
  theme,
  coupons,
  build,
  before,
  between = {},
  after,
  onSignOut,
  signOutLabel = "Log out",
  classNames: c = {},
}: AccountPageProps) {
  const [tzPref, tzZone] = useTimezone();
  const shown = {
    profile: profile !== false,
    sessionKey: sessionKey !== false,
    usage: usage !== false,
    timezone: timezone !== false,
    theme: theme !== false,
    coupons: coupons !== false,
    build: build !== false,
  };

  const section = (key: AccountSection): ReactNode => {
    switch (key) {
      case "profile":
        return <NostrProfilePanel npub={npub} {...opts(profile)} />;
      case "sessionKey":
        // Keyed by npub so a revealed key never carries across a sign-in.
        return <SessionKeyClaim key={npub} npub={npub} {...opts(sessionKey)} />;
      case "usage":
        return <UsageSummary {...opts(usage)} />;
      case "timezone": {
        const { heading: h = "Display time zone", intro, note, ...picker } = opts<AccountTimezoneProps>(timezone);
        return (
          <Section heading={h} intro={intro} c={c}>
            <TimezonePicker {...picker} />
            {note && <p className={c.sectionNote}>{note(tzPref, tzZone)}</p>}
          </Section>
        );
      }
      case "theme": {
        const { heading: h = "Appearance", intro, ...toggle } = opts<AccountThemeProps>(theme);
        return (
          <Section heading={h} intro={intro} c={c}>
            <ThemeToggle {...toggle} />
          </Section>
        );
      }
      case "coupons":
        return <CouponsPanel {...opts(coupons)} />;
      case "build":
        return <BuildInfoPanel {...opts(build)} />;
    }
  };

  return (
    <div className={c.root}>
      {heading != null && <h1 className={c.heading}>{heading}</h1>}
      {before}
      {accountSteps(shown, between).map((step) => (
        <Fragment key={`${step.kind}:${step.section}`}>
          {step.kind === "section" ? section(step.section) : between[step.section]}
        </Fragment>
      ))}
      {after}
      {onSignOut && (
        <div className={c.actions}>
          <button type="button" onClick={onSignOut} className={c.signOut}>
            {signOutLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  heading,
  intro,
  c,
  children,
}: AccountSectionText & { c: AccountPageClassNames; children: ReactNode }) {
  return (
    <section className={c.section}>
      {heading != null && <h2 className={c.sectionHeading}>{heading}</h2>}
      {intro != null && <p className={c.sectionIntro}>{intro}</p>}
      {children}
    </section>
  );
}
