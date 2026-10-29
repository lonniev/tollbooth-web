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
import { asText, getOperatorProperties, setOperatorProperty, type PropertyInfo } from "../properties.ts";
import { sessionStatus } from "../standardTools.ts";
import { errBox, iconButton, input } from "./ui.ts";

export interface OperatorPropertiesClassNames {
  root?: string;
  heading?: string;
  row?: string;
  label?: string;
  control?: string;
  reset?: string;
  error?: string;
}

export interface OperatorPropertiesProps {
  /** Default "Operator"; null for none. */
  heading?: ReactNode;
  classNames?: OperatorPropertiesClassNames;
}

export default function OperatorProperties({ heading = "Operator", classNames: c = {} }: OperatorPropertiesProps) {
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
      setError(r.error ?? "Not kept.");
      return;
    }
    setProps((ps) => ps?.map((p) => (p.name === name
      ? { ...p, value: "value" in r ? r.value : p.default, is_default: !!("is_default" in r && r.is_default) }
      : p)) ?? null);
  }, []);

  if (!props) return null;
  return (
    <section className={c.root}>
      {heading != null && <h2 className={c.heading}>{heading}</h2>}
      {props.map((p) => (
        <Row key={p.name} p={p} c={c} save={save} />
      ))}
      {error && <p role="alert" className={c.error ?? errBox}>{error}</p>}
    </section>
  );
}

function Row({ p, c, save }: { p: PropertyInfo; c: OperatorPropertiesClassNames; save: (n: string, v: string) => void }) {
  const id = useId();
  return (
    <div className={c.row ?? "flex items-center gap-2 py-1"}>
      <label htmlFor={id} title={p.description || undefined} className={c.label ?? "flex-1 text-sm"}>
        {p.label}
      </label>
      <Control id={id} p={p} className={c.control ?? `${input} max-w-xs`} save={(v) => save(p.name, v)} />
      <button
        type="button"
        aria-label={`${p.label}: default`}
        title={asText(p.default)}
        disabled={p.is_default}
        onClick={() => save(p.name, "")}
        className={c.reset ?? iconButton}
      >
        <RotateCcw size={16} aria-hidden />
      </button>
    </div>
  );
}

function Control({ id, p, className, save }: { id: string; p: PropertyInfo; className: string; save: (v: string) => void }) {
  const [draft, setDraft] = useState(asText(p.value));
  useEffect(() => setDraft(asText(p.value)), [p.value]);
  const commit = () => {
    if (draft !== asText(p.value)) save(draft);
  };
  const typed = {
    id, className, value: draft,
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
      return <input type="number" min={p.minimum} max={p.maximum} {...typed} />;
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
    default:
      return <input spellCheck={false} {...typed} />;
  }
}
