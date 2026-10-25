/**
 * The price sheet: every tool a patron can call, what it does and what it
 * costs, read live from the operator's pricing model, and how long a tranche
 * of credit lasts.
 *
 * Unlike the mechanics-only components this one carries its own look, in
 * `price-sheet.css`, so the sheet reads the same at every operator. It is
 * coloured only through the theme.css tokens, so a site's palette, dark mode
 * and fonts (`--tb-ps-display-font`, `--tb-ps-data-font`) carry over; a site
 * restyles further through `.tb-ps-*` in its own stylesheet.
 *
 * Tools are banded by fare, cheapest first, so the sheet reads like a menu;
 * the free tools fold away beneath. `get_pricing_model` is free and needs no
 * sign-in, so the page works for a visitor. Optional: a site that wants it
 * routes to it.
 *
 * Hovering a tool's card, or focusing it (a tap on a phone), opens its call
 * syntax: every parameter with its type, default and purpose, read from the
 * MCP `tools/list`. That read is best-effort; without it the cards still show.
 */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Bitcoin, Clock, Gift, Hash, Heart, Package, PartyPopper, RefreshCw, Search, Ticket, TrendingUp } from "lucide-react";
import { listTools } from "../client.ts";
import { tollboothConfig, toolName } from "../config.ts";
import { LIGHTNING_WALLETS_TOOL } from "../lightningWallets.ts";
import {
  filterSheet,
  priceSheet,
  type ExpiryPolicy,
  type PriceSheet as Sheet,
  type SheetPrice,
  type SheetTool,
} from "../priceSheet.ts";
import { getPricingModel, type PricingModelResult } from "../standardTools.ts";
import { signatureLines, toolSignature, type ToolSchema } from "../toolSignature.ts";
import { formatSats } from "../wallet.ts";
import RefreshButton from "./RefreshButton.tsx";
import WalletChooser from "./WalletChooser.tsx";
import { cx } from "./cx.ts";

export interface PriceSheetProps {
  /** The title. Default the site's `appName`; null for none. */
  heading?: ReactNode;
  /** The line above the title. Default "Price sheet"; null for none. */
  eyebrow?: ReactNode;
  /** A model already in hand. Without one the sheet reads `get_pricing_model`. */
  model?: PricingModelResult;
  /** Tool schemas already in hand. Without them the sheet reads `tools/list`; null for no call syntax. */
  schemas?: ToolSchema[] | null;
  /** Include operator-only tools. Default false: a patron cannot call them. */
  restricted?: boolean;
  /** Include tools the operator has not priced yet. Default false. */
  unpriced?: boolean;
  /** A tool's display name. Default its name in words ("Frost window"). */
  label?: (tool: SheetTool) => ReactNode;
  /** Offer a search once the sheet lists more tools than this. Default 12. */
  searchFrom?: number;
  /** Start with the free tools unfolded. Default false. */
  freeOpen?: boolean;
  /** Offer "Need a wallet?" beside the facts, where the operator serves the list. Default true. */
  walletHelp?: boolean;
  /** Site content under the header. */
  before?: ReactNode;
  /** Site content at the end. */
  children?: ReactNode;
  /** Added to the root, beside `tb-ps`. */
  className?: string;
}

const OFFER_ICONS: Record<string, typeof Gift> = {
  free_trial: Gift,
  loyalty_discount: Heart,
  bulk_bonus: Package,
  happy_hour: PartyPopper,
  surge_pricing: TrendingUp,
  temporal_window: Clock,
  finite_supply: Hash,
  periodic_refresh: RefreshCw,
  coupon: Ticket,
};

export default function PriceSheet({
  heading,
  eyebrow = "Price sheet",
  model: given,
  schemas: givenSchemas,
  restricted = false,
  unpriced = false,
  label = (t) => t.title,
  searchFrom = 12,
  freeOpen = false,
  walletHelp = true,
  before,
  children,
  className,
}: PriceSheetProps) {
  const { slug, appName } = tollboothConfig();
  const [model, setModel] = useState<PricingModelResult | null>(given ?? null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [schemas, setSchemas] = useState<ToolSchema[] | null>(givenSchemas ?? null);

  const load = useCallback(async () => {
    try {
      const m = await getPricingModel();
      if (m.status === "error" || m.error) setError(m.error ?? "The pricing model could not be read.");
      else {
        setModel(m);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (given) setModel(given);
    else void load();
  }, [given, load]);

  useEffect(() => {
    if (givenSchemas !== undefined) {
      setSchemas(givenSchemas);
      return;
    }
    let live = true;
    // Best-effort: the call syntax is a help, and the fares stand without it.
    listTools().then(
      (s) => live && setSchemas(s),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [givenSchemas]);

  const byName = useMemo(() => new Map((schemas ?? []).map((s) => [s.name, s])), [schemas]);

  const sheet = useMemo(
    () => (model ? priceSheet(model, { slug, restricted, unpriced }) : null),
    [model, slug, restricted, unpriced],
  );
  const shown = useMemo(() => (sheet ? filterSheet(sheet, query) : null), [sheet, query]);
  const total = sheet ? sheet.paidCount + sheet.free.length : 0;

  return (
    <section className={cx("tb-ps", className)} aria-busy={!sheet && !error}>
      <header className="tb-ps-head">
        <div className="tb-ps-titles">
          {eyebrow !== null && <p className="tb-ps-eyebrow">{eyebrow}</p>}
          {heading !== null && <h1 className="tb-ps-title">{heading ?? appName}</h1>}
          {sheet?.name && <p className="tb-ps-model">{sheet.name}</p>}
        </div>
        {!given && (
          <RefreshButton
            onRefresh={load}
            busy={!sheet && !error}
            label="Refresh prices"
            iconSize={18}
            classNames={{ root: "tb-ps-refresh", spinning: "tb-ps-spin" }}
          />
        )}
        {sheet && (
          <div className="tb-ps-facts">
            <CreditLife expiry={sheet.expiry} />
            <FareSpan sheet={sheet} />
            {walletHelp && byName.has(toolName(LIGHTNING_WALLETS_TOOL)) && <WalletChooser />}
          </div>
        )}
      </header>

      {before}

      {error ? (
        <p className="tb-ps-error" role="alert">
          {error}
        </p>
      ) : !sheet || !shown ? (
        <Skeleton />
      ) : (
        <>
          {total > searchFrom && (
            <label className="tb-ps-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a tool"
                aria-label="Find a tool"
              />
            </label>
          )}

          {shown.bands.length > 0 && (
            <ol className="tb-ps-ladder">
              {shown.bands.map((band) => (
                <li key={band.key} className="tb-ps-band">
                  <Fare price={band.price} />
                  <ul className="tb-ps-tools">
                    {band.tools.map((t) => (
                      <ToolCard key={t.id} tool={t} label={label} schema={byName.get(t.fullName)} />
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}

          {shown.free.length > 0 && (
            <details className="tb-ps-free" open={freeOpen || query.trim() !== ""}>
              <summary>
                <span className="tb-ps-free-title">Free</span>
                <span className="tb-ps-count">{shown.free.length}</span>
              </summary>
              <ul className="tb-ps-free-list">
                {shown.free.map((t) => (
                  <li key={t.id}>
                    <span className="tb-ps-free-name" title={t.fullName}>
                      {label(t)}
                    </span>
                    {t.intent && <span className="tb-ps-free-intent">{t.intent}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {shown.bands.length === 0 && shown.free.length === 0 && (
            <p className="tb-ps-empty">{query.trim() ? "No tool matches." : "No tools are priced yet."}</p>
          )}
        </>
      )}

      {children}
    </section>
  );
}

function CreditLife({ expiry }: { expiry: ExpiryPolicy }) {
  const [glyph, title, line] =
    expiry.state === "days"
      ? [String(expiry.days), `Credits last ${expiry.days} day${expiry.days === 1 ? "" : "s"}`, `Each top-up expires ${expiry.days} day${expiry.days === 1 ? "" : "s"} after it is bought.`]
      : expiry.state === "never"
        ? ["∞", "Credits never expire", "A top-up keeps until it is spent."]
        : ["∞", "No expiry set", "Credits bought now carry no expiry date."];
  return (
    <div className="tb-ps-fact" data-expiry={expiry.state}>
      <svg className="tb-ps-ring" viewBox="0 0 56 56" aria-hidden>
        <circle cx="28" cy="28" r="25" />
        <text x="28" y="28" dominantBaseline="central" textAnchor="middle">
          {glyph}
        </text>
      </svg>
      <div>
        <div className="tb-ps-fact-title">{title}</div>
        <div className="tb-ps-fact-line">{line}</div>
      </div>
    </div>
  );
}

function FareSpan({ sheet }: { sheet: Sheet }) {
  const { span } = sheet;
  const figure = !span ? "0" : span.low === span.high ? formatSats(span.low) : `${formatSats(span.low)}–${formatSats(span.high)}`;
  return (
    <div className="tb-ps-fact">
      <div className="tb-ps-span">
        <span className="tb-ps-span-n" aria-label={`${figure} sats`}>
          <Btc />
          {figure}
        </span>
        <span className="tb-ps-span-u" aria-hidden>sats</span>
      </div>
      <div>
        <div className="tb-ps-fact-title">
          {sheet.paidCount} paid · {sheet.free.length} free
        </div>
        <div className="tb-ps-fact-line">Fees are paid from your tranche of api_sats.</div>
      </div>
    </div>
  );
}

function Fare({ price }: { price: SheetPrice }) {
  switch (price.kind) {
    case "flat":
      return (
        <div className="tb-ps-fare">
          <data className="tb-ps-fare-n" value={price.sats} aria-label={`${formatSats(price.sats)} sats`}>
            <Btc />
            {formatSats(price.sats)}
          </data>
          <span className="tb-ps-fare-u" aria-hidden>sats</span>
        </div>
      );
    case "range":
      return (
        <div className="tb-ps-fare">
          <span className="tb-ps-fare-n" aria-label={`${formatSats(price.from)} to ${formatSats(price.to)} sats`}>
            <Btc />
            {formatSats(price.from)}–{formatSats(price.to)}
          </span>
          <span className="tb-ps-fare-u" aria-hidden>sats</span>
          <span className="tb-ps-fare-note">by {price.by.map((p) => p.replace(/_/g, " ")).join(", ")}</span>
        </div>
      );
    case "percent":
      return (
        <div className="tb-ps-fare">
          <span className="tb-ps-fare-n">{price.percent}%</span>
          {price.of && <span className="tb-ps-fare-u">of {price.of.replace(/_/g, " ")}</span>}
          {(price.min !== undefined || price.max !== undefined) && (
            <span className="tb-ps-fare-note">
              {price.min !== undefined && (
                <>
                  min <Btc />
                  {formatSats(price.min)}
                </>
              )}
              {price.min !== undefined && price.max !== undefined && " · "}
              {price.max !== undefined && (
                <>
                  max <Btc />
                  {formatSats(price.max)}
                </>
              )}{" "}
              sats
            </span>
          )}
        </div>
      );
  }
}

/** The sats sign, set before a figure the way $ or € would be; the "sats" beneath keeps it from reading as whole bitcoin. */
function Btc() {
  return <Bitcoin className="tb-ps-btc" aria-hidden />;
}

function ToolCard({
  tool,
  label,
  schema,
}: {
  tool: SheetTool;
  label: (t: SheetTool) => ReactNode;
  schema?: ToolSchema;
}) {
  const popId = useId();
  return (
    <li
      className="tb-ps-tool"
      data-has-call={schema ? "" : undefined}
      tabIndex={schema ? 0 : undefined}
      aria-describedby={schema ? popId : undefined}
    >
      <h3 className="tb-ps-tool-title">{label(tool)}</h3>
      {tool.intent && <p className="tb-ps-tool-intent">{tool.intent}</p>}
      <div className="tb-ps-tool-foot">
        <code className="tb-ps-tool-name">{tool.fullName}</code>
        {tool.offers.map((o) => {
          const Icon = OFFER_ICONS[o.type];
          return (
            <span key={o.type} className="tb-ps-offer" data-offer={o.type}>
              {Icon && <Icon size={12} aria-hidden />}
              {o.label}
            </span>
          );
        })}
      </div>
      {schema && <CallSyntax id={popId} schema={schema} />}
    </li>
  );
}

function CallSyntax({ id, schema }: { id: string; schema: ToolSchema }) {
  const params = toolSignature(schema.inputSchema);
  const described = params.filter((p) => p.description);
  return (
    <div id={id} role="tooltip" className="tb-ps-call">
      <pre className="tb-ps-call-sig">
        <code>{signatureLines(schema.name, params).join("\n")}</code>
      </pre>
      {described.length > 0 && (
        <dl className="tb-ps-call-params">
          {described.map((p) => (
            <div key={p.name}>
              <dt>
                {p.name}
                {!p.required && <span className="tb-ps-call-opt">optional</span>}
              </dt>
              <dd>{p.description}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="tb-ps-skeleton" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="tb-ps-skel-band">
          <div className="tb-ps-skel-fare" />
          <div className="tb-ps-skel-card" />
          <div className="tb-ps-skel-card" />
        </div>
      ))}
    </div>
  );
}
