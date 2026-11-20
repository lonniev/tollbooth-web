/**
 * The Profile page every site composed for itself, in one grouping for all of
 * them: You, Money, This site, Operator, About. Each group is a `<details>`
 * that folds open and shut, its body a grid of panels.
 *
 * Each built-in section is on by default; `false` turns it off and an object
 * passes it its own props. A site's own panels go in `panels.<group>`, after
 * that group's built-in sections. The operator group is drawn for the operator
 * alone. Log out closes the You group when `onSignOut` is given.
 */

import { useEffect, useState, type ReactNode } from "react";
import { isOperator } from "../funding.ts";
import { sessionStatus } from "../standardTools.ts";
import type { Kind0 } from "../standardTools.ts";
import type { TimezonePref } from "../timezone.ts";
import { accountGroups, type AccountGroup, type AccountSection } from "./accountSections.ts";
import BuildInfoPanel, { type BuildInfoPanelProps } from "./BuildInfoPanel.tsx";
import NostrProfilePanel from "./NostrProfilePanel.tsx";
import OperatorProperties, { type OperatorPropertiesProps } from "./OperatorProperties.tsx";
import PeersPanel from "./PeersPanel.tsx";
import SessionKeyClaim, { type SessionKeyClaimProps } from "./SessionKeyClaim.tsx";
import TextSizeToggle from "./TextSizeToggle.tsx";
import ThemeToggle, { type ThemeToggleProps } from "./ThemeToggle.tsx";
import TimezonePicker, { type TimezonePickerProps } from "./TimezonePicker.tsx";
import UsageSummary, { type UsageSummaryProps } from "./UsageSummary.tsx";
import { useT } from "./useT.ts";
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
  /** Each group: the `<details>`, its `<summary>`, and the grid of panels inside. */
  group?: string;
  groupSummary?: string;
  groupBody?: string;
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
  /** What the operator may tune; drawn only for the operator, where any are declared. */
  operator?: boolean | OperatorPropertiesProps;
  usage?: boolean | UsageSummaryProps;
  /** Who may see and fund this account, and whose accounts it funds. */
  peers?: boolean;
  timezone?: boolean | AccountTimezoneProps;
  theme?: boolean | AccountThemeProps;
  build?: boolean | BuildInfoPanelProps;
  /** The site's own panels, each after its group's built-in sections. */
  panels?: Partial<Record<Exclude<AccountGroup, "about">, ReactNode>>;
  onSignOut?: () => void;
  /** Default "Log out". */
  signOutLabel?: ReactNode;
  classNames?: AccountPageClassNames;
}

/** A group's panels side by side where they fit, one column on a phone. Never CSS columns: they split cards. */
const GRID = {
  display: "grid", gap: "0.75rem", alignItems: "start",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))",
} as const;

/** Each group's title, named key by key so every key is found where it is asked for. */
const GROUP_TITLE = {
  you: "account.group.you",
  money: "account.group.money",
  site: "account.group.site",
  operator: "account.group.operator",
  about: "account.group.about",
} as const;

const opts = <T extends object>(v: boolean | T | undefined): T => (typeof v === "object" ? v : ({} as T));

export default function AccountPage({
  npub,
  heading: headingProp,
  profile,
  sessionKey,
  operator,
  usage,
  peers,
  timezone,
  theme,
  build,
  panels = {},
  onSignOut,
  signOutLabel: signOutLabelProp,
  classNames: c = {},
}: AccountPageProps) {
  const t = useT();
  const [tzPref, tzZone] = useTimezone();
  // The operator group is the operator's alone, gated as OperatorProperties gates itself.
  const [operatorHere, setOperatorHere] = useState(false);
  useEffect(() => {
    let live = true;
    sessionStatus().then((s) => live && setOperatorHere(isOperator(npub, s))).catch(() => undefined);
    return () => { live = false; };
  }, [npub]);
  const heading = headingProp === undefined ? t("account.heading") : headingProp;
  const signOutLabel = signOutLabelProp === undefined ? t("account.signOut") : signOutLabelProp;
  const shown = {
    profile: profile !== false,
    sessionKey: sessionKey !== false,
    operator: operator !== false,
    usage: usage !== false,
    peers: peers !== false,
    timezone: timezone !== false,
    theme: theme !== false,
    build: build !== false,
  };

  const section = (key: AccountSection): ReactNode => {
    switch (key) {
      case "profile":
        return <NostrProfilePanel npub={npub} {...opts(profile)} />;
      case "sessionKey":
        // Keyed by npub so a revealed key never carries across a sign-in.
        return <SessionKeyClaim key={npub} npub={npub} {...opts(sessionKey)} />;
      case "operator":
        return <OperatorProperties heading={null} {...opts(operator)} />;
      case "usage":
        return <UsageSummary {...opts(usage)} />;
      case "peers":
        // Keyed by npub so a half-made ask never carries across a sign-in.
        return <PeersPanel key={npub} npub={npub} />;
      case "timezone": {
        const { heading: h, intro, note, ...picker } = opts<AccountTimezoneProps>(timezone);
        return (
          <Section heading={h === undefined ? t("account.timezoneHeading") : h} intro={intro} c={c}>
            <TimezonePicker {...picker} />
            {note && <p className={c.sectionNote}>{note(tzPref, tzZone)}</p>}
          </Section>
        );
      }
      case "theme": {
        const { heading: h, intro, ...toggle } = opts<AccountThemeProps>(theme);
        return (
          <Section heading={h === undefined ? t("account.appearanceHeading") : h} intro={intro} c={c}>
            <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
              <ThemeToggle {...toggle} />
              <TextSizeToggle classNames={toggle.classNames} />
            </div>
          </Section>
        );
      }
      case "build":
        return <BuildInfoPanel {...opts(build)} />;
    }
  };

  const plan = accountGroups(shown, panels, { operator: operatorHere, signOut: Boolean(onSignOut) });
  return (
    <div className={c.root}>
      {heading != null && <h1 className={c.heading}>{heading}</h1>}
      {plan.map(({ group, sections, panels: given }) => (
        <details key={group} open className={c.group} data-account-group={group}>
          <summary className={c.groupSummary}>{t(GROUP_TITLE[group])}</summary>
          <div className={c.groupBody} style={c.groupBody ? undefined : GRID}>
            {sections.map((s) => <div key={s} style={{ display: "contents" }}>{section(s)}</div>)}
            {given && group !== "about" && panels[group]}
            {group === "you" && onSignOut && (
              <div className={c.actions}>
                <button type="button" onClick={onSignOut} className={c.signOut}>
                  {signOutLabel}
                </button>
              </div>
            )}
          </div>
        </details>
      ))}
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
