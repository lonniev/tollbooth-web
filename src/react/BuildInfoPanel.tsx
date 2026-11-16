/**
 * Build & license: what is running and under what terms — the front end's
 * version and commit (the site's, passed in, since only its bundler knows
 * them), the MCP server's version, wheel and deployed commit linked to its
 * repository (from `service_status`), the Tollbooth-DPYC™ links, the licence,
 * and the patent and trademark notice.
 *
 * Mechanics only: every visual choice is the site's, through `classNames`;
 * `intro` carries the site's own words and `children` any rows of its own,
 * drawn after the MCP server section. Pass `status` when the site already
 * holds a `service_status` answer; without it the panel asks once.
 */

import { useEffect, useState, type ReactNode } from "react";
import { buildFacts } from "../buildInfo.ts";
import { serviceStatus, type ServiceStatus } from "../standardTools.ts";
import { cx } from "./cx.ts";
import { useT } from "./useT.ts";

export interface BuildInfoFrontend {
  version?: string;
  commit?: string;
  builtAt?: string;
  /** The front end's repository, an https URL. */
  source?: string;
}

export interface BuildInfoLicence {
  name: string;
  href?: string;
}

export interface BuildInfoPanelClassNames {
  root?: string;
  heading?: string;
  intro?: string;
  /** Each section's label: Frontend, MCP server, … */
  section?: string;
  row?: string;
  label?: string;
  value?: string;
  /** Added to a value that is a link. */
  link?: string;
}

export interface BuildInfoPanelProps {
  /** A `service_status` answer the site already has; omitted, the panel fetches one. */
  status?: ServiceStatus | null;
  frontend?: BuildInfoFrontend;
  /** Default "Build & license". */
  heading?: ReactNode;
  intro?: ReactNode;
  /** Default Apache 2.0, the licence of every DPYC repository. */
  licence?: BuildInfoLicence;
  children?: ReactNode;
  classNames?: BuildInfoPanelClassNames;
}

const APACHE: BuildInfoLicence = { name: "Apache 2.0", href: "https://www.apache.org/licenses/LICENSE-2.0" };

type C = BuildInfoPanelClassNames;

function bare(href: string): string {
  return href.replace(/^https:\/\//, "").replace(/\/+$/, "");
}

function isHttps(href: string | undefined): href is string {
  return !!href && href.startsWith("https://");
}

function Section({ c, children }: { c: C; children: ReactNode }) {
  return <div className={c.section}>{children}</div>;
}

function Row({ c, label, value, href }: { c: C; label: ReactNode; value: string; href?: string | null }) {
  return (
    <div className={c.row}>
      <span className={c.label}>{label}</span>{" "}
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cx(c.value, c.link)}>
          {value}
        </a>
      ) : (
        <span className={c.value}>{value}</span>
      )}
    </div>
  );
}

export default function BuildInfoPanel({
  status,
  frontend,
  heading: headingProp,
  intro,
  licence = APACHE,
  children,
  classNames: c = {},
}: BuildInfoPanelProps) {
  const t = useT();
  const heading = headingProp === undefined ? t("build.heading") : headingProp;
  const [fetched, setFetched] = useState<ServiceStatus | null>(null);

  useEffect(() => {
    if (status !== undefined) return;
    let live = true;
    serviceStatus()
      .then((s) => live && setFetched(s))
      .catch(() => {
        /* the rows read "—" */
      });
    return () => {
      live = false;
    };
  }, [status]);

  const f = buildFacts(status === undefined ? fetched : status);
  const feVersion = [frontend?.version, frontend?.commit].filter(Boolean).join(" · ");

  return (
    <section className={c.root}>
      {heading && <div className={c.heading}>{heading}</div>}
      {intro && <div className={c.intro}>{intro}</div>}

      {frontend && (
        <>
          <Section c={c}>{t("build.frontend")}</Section>
          <Row c={c} label={t("build.version")} value={feVersion || "—"} />
          {frontend.builtAt && <Row c={c} label={t("build.builtAt")} value={frontend.builtAt} />}
          {isHttps(frontend.source) && <Row c={c} label={t("build.source")} value={bare(frontend.source)} href={frontend.source} />}
        </>
      )}

      <Section c={c}>{t("build.mcpServer")}</Section>
      <Row c={c} label={t("build.version")} value={f.version ?? "—"} />
      <Row c={c} label={t("build.commit")} value={f.commit ?? "—"} href={f.commitHref} />
      <Row c={c} label="tollbooth-dpyc" value={f.sdkVersion ? t("build.wheel", { version: f.sdkVersion }) : "—"} />
      {f.repo && <Row c={c} label={t("build.source")} value={f.repo} href={f.repoHref} />}

      {children}

      <Section c={c}>Tollbooth-DPYC™</Section>
      <Row c={c} label={t("build.marketing")} value="tollbooth-dpyc.com" href="https://tollbooth-dpyc.com" />
      <Row c={c} label={t("build.community")} value="github.com/lonniev/dpyc-community" href="https://github.com/lonniev/dpyc-community" />
      <Row c={c} label={t("build.wheelSource")} value="github.com/lonniev/tollbooth-dpyc" href="https://github.com/lonniev/tollbooth-dpyc" />

      <Section c={c}>{t("build.license")}</Section>
      <Row c={c} label={licence.name} value={licence.href ? bare(licence.href) : licence.name} href={isHttps(licence.href) ? licence.href : null} />

      <Section c={c}>{t("build.patentAndTrademarks")}</Section>
      <Row c={c} label={t("build.patent")} value={t("build.patentPending")} />
      <Row c={c} label={t("build.filing")} value="dpyc-community/docs/patent" href="https://github.com/lonniev/dpyc-community/tree/main/docs/patent" />
      <Row c={c} label={t("build.trademarks")} value="DPYC™ · Tollbooth DPYC™ · Don't Pester Your Customer™" />
    </section>
  );
}
