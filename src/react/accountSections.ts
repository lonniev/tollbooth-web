/**
 * How `AccountPage` groups what it draws, one grouping for every site.
 *
 * Five groups, in this order:
 *   - you: who you are and how pages look to you;
 *   - money: what you hold here, and who funds whom;
 *   - site: what this site keeps for you (a calendar feed, a station key…);
 *   - operator: what the operator tunes, drawn for the operator alone;
 *   - about: which build this is.
 * Each group holds its built-in sections, then the site's own panels for it.
 * A group with nothing in it is not drawn.
 */

export type AccountSection =
  "profile" | "sessionKey" | "operator" | "usage" | "peers" | "timezone" | "theme" | "build";

export type AccountGroup = "you" | "money" | "site" | "operator" | "about";

/** Each group and its built-in sections, in the order they are drawn. */
export const ACCOUNT_GROUPS: readonly { group: AccountGroup; sections: readonly AccountSection[] }[] = [
  { group: "you", sections: ["profile", "theme", "timezone", "sessionKey"] },
  { group: "money", sections: ["usage", "peers"] },
  { group: "site", sections: [] },
  { group: "operator", sections: ["operator"] },
  { group: "about", sections: ["build"] },
];

export interface AccountGroupPlan {
  group: AccountGroup;
  /** The built-in sections shown in it. */
  sections: AccountSection[];
  /** Whether the site gave panels for it. */
  panels: boolean;
}

/**
 * The groups to draw: each with its shown sections and whether the site gave
 * panels for it. The operator group is drawn only for the operator; the you
 * group always, since Log out lives there.
 */
export function accountGroups(
  shown: Partial<Record<AccountSection, boolean>>,
  panels: Partial<Record<AccountGroup, unknown>>,
  { operator, signOut = false }: { operator: boolean; signOut?: boolean },
): AccountGroupPlan[] {
  const out: AccountGroupPlan[] = [];
  for (const { group, sections } of ACCOUNT_GROUPS) {
    if (group === "operator" && !operator) continue;
    const on = sections.filter((s) => shown[s] !== false);
    const given = panels[group] != null && panels[group] !== false;
    if (on.length || given || (group === "you" && signOut)) out.push({ group, sections: on, panels: given });
  }
  return out;
}
