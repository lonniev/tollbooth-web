/**
 * The order `AccountPage` draws its sections in, one order for every site, and
 * where a site's own panels go between them.
 */

export type AccountSection = "profile" | "sessionKey" | "usage" | "timezone" | "theme" | "coupons" | "build";

export const ACCOUNT_SECTIONS: readonly AccountSection[] = [
  "profile",
  "sessionKey",
  "usage",
  "timezone",
  "theme",
  "coupons",
  "build",
];

export type AccountStep = { kind: "section"; section: AccountSection } | { kind: "between"; section: AccountSection };

/**
 * Each shown section in order, each followed by the site's panel placed after
 * it. A site panel keeps its place when the section before it is hidden — a
 * site that brings its own coupons turns the package's off and puts its own
 * `between.theme`, and it lands where the coupons would have been.
 */
export function accountSteps(
  shown: Partial<Record<AccountSection, boolean>>,
  between: Partial<Record<AccountSection, unknown>>,
): AccountStep[] {
  const steps: AccountStep[] = [];
  for (const section of ACCOUNT_SECTIONS) {
    if (shown[section] !== false) steps.push({ kind: "section", section });
    if (between[section] != null && between[section] !== false) steps.push({ kind: "between", section });
  }
  return steps;
}
