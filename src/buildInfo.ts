/**
 * What `service_status` says about the running build: the server's version,
 * the tollbooth-dpyc wheel under it, and the commit it was deployed from,
 * linked to its repository. Framework-free, so it is tested without React.
 *
 * Hrefs come from the server, so only an https URL becomes a link; anything
 * else is shown as text.
 */

import type { ServiceStatus } from "./standardTools.ts";

export interface BuildFacts {
  version: string | null;
  sdkVersion: string | null;
  /** The deployed commit, short (7 characters). */
  commit: string | null;
  /** The commit on its host, when the repository is on GitHub. */
  commitHref: string | null;
  /** The repository without its scheme, e.g. "github.com/lonniev/excalibur-mcp". */
  repo: string | null;
  repoHref: string | null;
}

function httpsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function buildFacts(status: ServiceStatus | null | undefined): BuildFacts {
  const info = status?.build_info ?? {};
  const sha = /^[0-9a-f]{7,40}$/i.test(info.fastmcp_cloud_git_commit_sha ?? "")
    ? info.fastmcp_cloud_git_commit_sha!
    : null;
  const repoUrl = httpsUrl(info.fastmcp_cloud_git_repo);
  const repoHref = repoUrl ? repoUrl.href.replace(/\/+$/, "") : null;
  return {
    version: status?.version || null,
    sdkVersion: status?.tollbooth_dpyc_version || null,
    commit: sha ? sha.slice(0, 7) : null,
    commitHref: sha && repoUrl?.hostname === "github.com" ? `${repoHref}/commit/${sha}` : null,
    repo: repoHref ? repoHref.replace(/^https:\/\//, "") : (info.fastmcp_cloud_git_repo || null),
    repoHref,
  };
}
