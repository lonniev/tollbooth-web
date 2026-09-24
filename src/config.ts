/**
 * The one thing that differs between operator front ends.
 *
 * Every copy of this code in the fleet differed from its siblings in the same
 * few places: the tool-name slug, the brand in a sign-in DM and a heading, and
 * the prefix on its localStorage keys. Those are configuration, so they live
 * here and nowhere else. A site calls `configureTollbooth` once, before it
 * renders, and everything in the package reads from it.
 */

export interface TollboothConfig {
  /** Tool-name prefix the operator registers under, e.g. "chart" or "goodearth". */
  slug: string;
  /** The name a patron knows the service by, e.g. "ChartRemotely". */
  appName: string;
  /** Prefix for localStorage keys. Defaults to the slug. */
  storagePrefix?: string;
  /**
   * Where the MCP endpoint is. A path ("/mcp") is resolved against the page's
   * origin, which is how every site reaches its Pages proxy.
   */
  mcpUrl: string;
  /**
   * Free tools this operator adds that take no npub/proof envelope, on top of
   * the standard ones. Pydantic rejects unexpected kwargs, so a tool listed
   * here must truly not accept `npub`.
   */
  extraBootstrapTools?: string[];
  /** Tools too routine to log in the debug panel. */
  quietTools?: string[];
  /** Avatar glyphs in this site's voice. Defaults to a general set. */
  avatarChoices?: string[];
}

interface Resolved
  extends Required<Omit<TollboothConfig, "extraBootstrapTools" | "quietTools" | "avatarChoices">> {
  extraBootstrapTools: string[];
  quietTools: string[];
  avatarChoices?: string[];
}

let current: Resolved | null = null;

export function configureTollbooth(config: TollboothConfig): void {
  if (!/^[a-z][a-z0-9_]*$/.test(config.slug)) {
    throw new Error(`slug must be lowercase letters, digits or underscores: ${config.slug}`);
  }
  current = {
    slug: config.slug,
    appName: config.appName,
    storagePrefix: config.storagePrefix ?? config.slug,
    mcpUrl: config.mcpUrl,
    extraBootstrapTools: config.extraBootstrapTools ?? [],
    quietTools: config.quietTools ?? [],
    avatarChoices: config.avatarChoices,
  };
}

export function tollboothConfig(): Resolved {
  if (!current) {
    throw new Error("configureTollbooth() must be called before the app renders.");
  }
  return current;
}

/** The runtime tool name a proof must be bound to, e.g. "chart_snapshot_display". */
export function toolName(tool: string): string {
  return `${tollboothConfig().slug}_${tool}`;
}
