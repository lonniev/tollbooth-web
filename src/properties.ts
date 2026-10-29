/**
 * Properties: the patron's (and the operator's) own settings, read and set one
 * way whether they follow the account or stay on this device.
 *
 * The wheel declares each property — its kind, default and `follows` — and
 * keeps the account-following ones by npub (`get_my_properties`,
 * `set_my_property`). Every property also has a local copy here, so a page
 * paints with it before the server answers and a signed-out visitor still has
 * one. A device-following property never leaves the browser.
 *
 * On sign-in, `syncProperties` settles the two: the account's value wins, and
 * the first time an npub signs in on a device that already holds a choice the
 * account lacks, that choice is written up once, so nobody loses a setting.
 *
 * The standard ones (`timezone`, `tour`) keep the storage they always had:
 * their modules register a `mirror` over it. Anything else is stored as JSON
 * under `<prefix>:prop:<name>`.
 */

import { callTool, type CallOptions } from "./client.ts";
import { debugPush } from "./debugLog.ts";
import { getStoredNpub } from "./identity.ts";
import { mirrors, notifyProperty, type PropertyMirror } from "./propertyMirrors.ts";
import { readStored, writeStored } from "./storage.ts";

export type PropertyKind = "llm_model" | "choice" | "list" | "number" | "flag" | "text";
export type PropertyFollows = "account" | "device";

export interface PropertyInfo {
  name: string;
  kind: PropertyKind;
  label: string;
  description: string;
  default: unknown;
  follows: PropertyFollows;
  choices?: string[];
  minimum?: number;
  maximum?: number;
  suggestions?: string[];
  value: unknown;
  is_default: boolean;
  updated_at: string;
}

export interface PropertiesResult {
  success?: boolean;
  properties?: PropertyInfo[];
  error?: string;
  error_code?: string;
}

export interface PropertyWriteResult {
  success?: boolean;
  name?: string;
  value?: unknown;
  is_default?: boolean;
  error?: string;
  error_code?: string;
}

// ── The tools ───────────────────────────────────────────────────────────────

/** The signed-in patron's properties: specs, and values for the account ones. */
export function getMyProperties(opts?: CallOptions): Promise<PropertiesResult> {
  return callTool<PropertiesResult>("get_my_properties", {}, opts);
}

/** Set one of the patron's own; `""` returns it to its default. */
export function setMyProperty(name: string, value: string, opts?: CallOptions): Promise<PropertyWriteResult> {
  return callTool<PropertyWriteResult>("set_my_property", { name, value }, opts);
}

/** What the operator may tune, and what each is set to. Anyone may read them. */
export function getOperatorProperties(opts?: CallOptions): Promise<PropertiesResult> {
  return callTool<PropertiesResult>("get_operator_properties", {}, opts);
}

/** Operator only: set one operator property; `""` returns it to its default. */
export function setOperatorProperty(name: string, value: string, opts?: CallOptions): Promise<PropertyWriteResult> {
  return callTool<PropertyWriteResult>("set_operator_property", { name, value }, opts);
}

/** A value as the tools take it: text as it is, anything else as JSON. */
export function asText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

// ── The local copy ──────────────────────────────────────────────────────────

export { mirrorProperty, onPropertyChange, type PropertyMirror } from "./propertyMirrors.ts";

function storedJson(name: string): PropertyMirror {
  const k = `prop:${name}`;
  return {
    read() {
      const raw = readStored(k);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    write(value) {
      writeStored(k, JSON.stringify(value));
      notifyProperty(name);
    },
  };
}

function mirror(name: string): PropertyMirror {
  return mirrors.get(name) ?? storedJson(name);
}

// ── Reading and setting ─────────────────────────────────────────────────────

const specs = new Map<string, PropertyInfo>();

/** The local copy, or the declared default, or `fallback`. */
export function readProperty<T>(name: string, fallback: T): T {
  const local = mirror(name).read();
  if (local !== undefined) return local as T;
  const spec = specs.get(name);
  return (spec ? spec.default : fallback) as T;
}

/** Set a property here, and on the account when it follows the account. */
export function writeProperty(name: string, value: unknown): void {
  mirror(name).write(value);
  propertyChanged(name, value);
}

/**
 * Tell the account a property changed — for a module that stores its own
 * (`writeTimezonePref`). Only an account-following property, only when
 * someone is signed in, and only once its spec is known: a change before the
 * first sync is written up by that sync.
 */
export function propertyChanged(name: string, value: unknown): void {
  if (!getStoredNpub() || specs.get(name)?.follows !== "account") return;
  tools.set(name, asText(value)).then(
    (r) => {
      if (r && r.success === false) debugPush("error", `${name} not kept: ${r.error ?? r.error_code ?? "refused"}`);
    },
    (e: unknown) => debugPush("error", `${name} not kept: ${e instanceof Error ? e.message : String(e)}`),
  );
}

// ── Settling on sign-in ─────────────────────────────────────────────────────

interface PropertyTools {
  get(): Promise<PropertiesResult>;
  set(name: string, value: string): Promise<PropertyWriteResult>;
}

let tools: PropertyTools = { get: () => getMyProperties(), set: (n, v) => setMyProperty(n, v) };
let syncedFor = "";

/** For tests: answer the two tools without a server. */
export function answerPropertyTools(next: PropertyTools): void {
  tools = next;
  syncedFor = "";
  specs.clear();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Settle this device with `npub`'s account: once per sign-in. The account's
 * value wins; on the first sign-in of `npub` on this device, a local choice
 * the account lacks is written up instead. A server that cannot answer leaves
 * the local copies as they are.
 */
export async function syncProperties(npub: string): Promise<void> {
  if (!npub || syncedFor === npub) return;
  let r: PropertiesResult;
  try {
    r = await tools.get();
  } catch (e) {
    debugPush("error", `properties not read: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  if (!r.success || !r.properties) return;
  const firstHere = !readStored(`prop-synced:${npub}`);
  for (const p of r.properties) {
    specs.set(p.name, p);
    if (p.follows !== "account") continue;
    const m = mirror(p.name);
    const local = m.read();
    if (local === undefined ? !p.is_default : !same(local, p.value)) {
      if (p.is_default && firstHere) {
        await tools.set(p.name, asText(local)).catch(() => undefined);
      } else {
        m.write(p.value);
      }
    }
  }
  writeStored(`prop-synced:${npub}`, new Date().toISOString());
  syncedFor = npub;
}
