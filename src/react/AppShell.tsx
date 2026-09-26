/**
 * The frame every operator site had written for itself: who is signed in, the
 * sign-in gate when nobody is, the service's status, the theme, the footer and
 * the debug log — laid out so the log's room never pushes a bottom rail off
 * the screen.
 *
 * It owns no routes. `children(shell)` draws the signed-in site (its nav and
 * its router); `signedOut(shell)` draws the signed-out one, with
 * `shell.gate` — the package `NpubGate`, already wired to sign in, to the
 * operator's fingerprint and to the "your sign-in lapsed" note — wherever it
 * belongs (under a hero, or on one route of a public site). Without
 * `signedOut` the gate is the page.
 *
 * Inside, `useAppShell()` gives any component the same `shell` — the npub,
 * `signOut`, the `service_status` answer — so a site keeps no session context
 * of its own.
 *
 * Also done here, once: the stored theme applied before paint and followed
 * across tabs; the npub's kind-0 picture seeded as its avatar; `DebugPanel`
 * mounted last, so its spacer is the page's last thing (see `shellLayout`).
 */

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { hydrateAvatarFromNostr } from "../avatar.ts";
import { serviceStatus, type ServiceStatus } from "../standardTools.ts";
import { bootstrapTheme, type Theme } from "../theme.ts";
import DebugPanel, { type DebugPanelProps } from "./DebugPanel.tsx";
import NpubGate from "./NpubGate.tsx";
import { shellLayout, type ShellFit } from "./shellLayout.ts";
import { useSession, type Session } from "./useSession.ts";
import { useTheme } from "./useTheme.ts";

export interface AppShellContext {
  session: Session;
  /** The `service_status` answer, or null until (or unless) it comes. */
  status: ServiceStatus | null;
  /** The sign-in gate, ready to place. */
  gate: ReactNode;
}

export interface AppShellClassNames {
  root?: string;
  /** The region the site draws in, between the top of the page and the footer. */
  body?: string;
}

export interface AppShellProps {
  /** The signed-in site: its nav, its routes. */
  children: (shell: AppShellContext) => ReactNode;
  /** The signed-out site, placing `shell.gate`. Default: the gate alone. */
  signedOut?: (shell: AppShellContext) => ReactNode;
  footer?: ReactNode | ((shell: AppShellContext) => ReactNode);
  /** The debug log's props (its children are the site's own section), or false for none. */
  debug?: DebugPanelProps | false;
  /** The theme when none is stored. Default "dark". */
  theme?: Theme;
  /** "page" grows with the content; "viewport" pins to the screen for a bottom rail. Default "page". */
  fit?: ShellFit;
  /** Arrive at the gate with a new key already made. */
  startFresh?: boolean;
  classNames?: AppShellClassNames;
}

const Ctx = createContext<AppShellContext | null>(null);

/** The shell's session, status and gate, for any component inside `AppShell`. */
export function useAppShell(): AppShellContext {
  const shell = useContext(Ctx);
  if (!shell) throw new Error("useAppShell must be used inside <AppShell>");
  return shell;
}

export default function AppShell({
  children,
  signedOut,
  footer,
  debug = {},
  theme = "dark",
  fit = "page",
  startFresh,
  classNames: c = {},
}: AppShellProps) {
  const session = useSession();
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  useTheme(theme);

  useLayoutEffect(() => {
    bootstrapTheme(theme);
  }, [theme]);

  useEffect(() => {
    let live = true;
    serviceStatus({ bestEffort: true })
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus(null));
    return () => {
      live = false;
    };
  }, []);

  const { npub, signedIn, notice, refresh } = session;
  useEffect(() => {
    if (signedIn && npub) void hydrateAvatarFromNostr(npub);
  }, [signedIn, npub]);

  const gate = (
    <NpubGate onLogin={refresh} operatorHash={status?.operator_npub_hash} notice={notice} startFresh={startFresh} />
  );
  const shell: AppShellContext = { session, status, gate };
  const layout = shellLayout(fit);

  return (
    <Ctx.Provider value={shell}>
      <div className={c.root} style={layout.root}>
        <div className={c.body} style={layout.body}>
          {signedIn ? children(shell) : signedOut ? signedOut(shell) : gate}
        </div>
        {typeof footer === "function" ? footer(shell) : footer}
        {debug !== false && <DebugPanel {...debug} />}
      </div>
    </Ctx.Provider>
  );
}
