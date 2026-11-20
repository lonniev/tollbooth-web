/**
 * The operator's properties — e.g. which LLM model each use runs on — as one
 * row each: its label, the control for its kind, and ↺ back to the default.
 * Saved as each is changed. Renders nothing for anyone but the operator, and
 * nothing where the operator declares none.
 */

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { isOperator } from "../funding.ts";
import { currentClaim } from "../identity.ts";
import { asText, getOperatorProperties, setOperatorProperty, withUnit, type PropertyInfo } from "../properties.ts";
import { sessionStatus } from "../standardTools.ts";
import { errBox, iconButton, input } from "./ui.ts";
import { useT } from "./useT.ts";

export interface OperatorPropertiesClassNames {
  root?: string;
  heading?: string;
  row?: string;
  label?: string;
  /** The property's description, a line under its row. */
  description?: string;
  control?: string;
  reset?: string;
  error?: string;
}

export interface OperatorPropertiesProps {
  /** Default "Operator"; null for none. */
  heading?: ReactNode;
  classNames?: OperatorPropertiesClassNames;
  /** Properties the site edits in a panel of its own, left out here. */
  omit?: string[];
}

export default function OperatorProperties({ heading: headingProp, classNames: c = {}, omit }: OperatorPropertiesProps) {
  const t = useT();
  const heading = headingProp === undefined ? t("operator.heading") : headingProp;
  const [props, setProps] = useState<PropertyInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // Gate first: a patron asks for nothing of the operator's.
      if (!isOperator(currentClaim().npub, await sessionStatus().catch(() => null))) return;
      const r = await getOperatorProperties().catch(() => null);
      if (live && r?.success && r.properties?.length) setProps(r.properties);
    })();
    return () => {
      live = false;
    };
  }, []);

  const save = useCallback(async (name: string, value: string) => {
    setError(null);
    const r = await setOperatorProperty(name, value).catch((e: Error) => ({ success: false, error: e.message }));
    if (!r.success) {
      setError(r.error ?? t("operator.notKept"));
      return;
    }
    setProps((ps) => ps?.map((p) => (p.name === name
      ? { ...p, value: "value" in r ? r.value : p.default, is_default: !!("is_default" in r && r.is_default) }
      : p)) ?? null);
  }, [t]);

  const shown = props?.filter((p) => !omit?.includes(p.name)) ?? [];
  if (!shown.length) return null;
  return (
    <section className={c.root}>
      {heading != null && <h2 className={c.heading}>{heading}</h2>}
      {shown.map((p) => (
        <Row key={p.name} p={p} c={c} save={save} />
      ))}
      {error && <p role="alert" className={c.error ?? errBox}>{error}</p>}
    </section>
  );
}

function Row({ p, c, save }: { p: PropertyInfo; c: OperatorPropertiesClassNames; save: (n: string, v: string) => void }) {
  const t = useT();
  const id = useId();
  return (
    <div>
    <div className={c.row ?? "flex items-center gap-2 py-1"}>
      <label htmlFor={id} className={c.label ?? "flex-1 text-sm"}>
        {p.label}
      </label>
      <Control id={id} p={p} className={c.control ?? `${input} max-w-xs`} save={(v) => save(p.name, v)} />
      <button
        type="button"
        aria-label={t("operator.resetLabel", { label: p.label })}
        title={asText(p.default)}
        disabled={p.is_default}
        onClick={() => save(p.name, "")}
        className={c.reset ?? iconButton}
      >
        <RotateCcw size={16} aria-hidden />
      </button>
    </div>
    {p.description && <p className={c.description ?? "text-xs opacity-70"}>{p.description}</p>}
    </div>
  );
}

function Control({ id, p, className, save }: { id: string; p: PropertyInfo; className: string; save: (v: string) => void }) {
  const [draft, setDraft] = useState(asText(p.value));
  useEffect(() => setDraft(asText(p.value)), [p.value]);
  const commit = () => {
    if (draft !== asText(p.value)) save(draft);
  };
  // What to show faintly while the field is empty: the operator's own suggestion, else the default.
  const hint = p.suggestions?.[0] ?? (p.default == null ? undefined : asText(p.default));
  const typed = {
    id, className, value: draft, placeholder: hint,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: { key: string }) => e.key === "Enter" && commit(),
  };
  switch (p.kind) {
    case "choice":
      return (
        <select id={id} className={className} value={draft} onChange={(e) => save(e.target.value)}>
          {(p.choices ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "flag":
      return (
        <input id={id} type="checkbox" checked={p.value === true}
          onChange={(e) => save(e.target.checked ? "true" : "false")} />
      );
    case "number":
      if (p.minimum == null || p.maximum == null) {
        return (
          <span className="flex items-center gap-2">
            <input type="number" min={p.minimum} max={p.maximum} {...typed} />
            {p.unit && <span>{p.unit}</span>}
          </span>
        );
      }
      // A bounded number is a slider, kept when it is let go of; its value reads beside it.
      return (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <input id={id} type="range" className="min-w-0 flex-1" min={p.minimum} max={p.maximum}
            step={Number.isInteger(p.minimum) && Number.isInteger(p.maximum) ? 1 : "any"}
            value={draft === "" ? (hint ?? p.minimum) : draft}
            onChange={(e) => setDraft(e.target.value)} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
          <output htmlFor={id} className="text-right tabular-nums whitespace-nowrap">
            {withUnit(draft === "" ? hint : draft, p.unit)}
          </output>
        </span>
      );
    case "llm_model": {
      const listId = `${id}-models`;
      return (
        <>
          <input list={listId} spellCheck={false} {...typed} />
          <datalist id={listId}>
            {["writer", "reader", ...(p.suggestions ?? [])].map((m) => <option key={m} value={m} />)}
          </datalist>
        </>
      );
    }
    default: {
      if (!p.suggestions?.length) return <input spellCheck={false} {...typed} />;
      const listId = `${id}-suggestions`;
      return (
        <>
          <input list={listId} spellCheck={false} {...typed} />
          <datalist id={listId}>{p.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        </>
      );
    }
  }
}
