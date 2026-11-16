/**
 * The pure half of `SignInSteps` (named apart from it: the filesystem is case-blind): what happens when someone signs in, in the
 * order it happens, and which step is under way for a given gate stage.
 *
 * Nine steps, four actors, one emoji each. The words are the visitor's, not the protocol's:
 * "the operator" (never MCP), "a proof" (never dpop), "this page" (never FE).
 * A site may pass its own list to `SignInSteps`; this one is the default.
 */

import { en as signin } from "../i18n/en.ts";
import type { TranslationKey } from "../i18n/index.ts";

/** Where the gate stands. `sending` is `begin` with a request in flight. */
export type SignInStage = "begin" | "sending" | "awaiting" | "checking" | "done";

export type SignInActor = "you" | "page" | "operator" | "client";

export interface SignInStep {
  id: string;
  actor: SignInActor;
  /** One emoji that pictures the step. */
  glyph: string;
  /** Two or three words, on the tile. */
  label: string;
  /** The label's key in the package's words; when set, the strip shows it in the reader's language. */
  labelKey?: TranslationKey;
  /** The stage during which this step is the one under way. */
  at: SignInStage;
}

export type SignInStepState = "done" | "current" | "todo";

export const SIGN_IN_ACTORS: Readonly<Record<SignInActor, string>> = {
  you: signin["signin.actor.you"],
  page: signin["signin.actor.page"],
  operator: signin["signin.actor.operator"],
  client: signin["signin.actor.client"],
};

export const SIGN_IN_ACTOR_KEYS: Readonly<Record<SignInActor, TranslationKey>> = {
  you: "signin.actor.you",
  page: "signin.actor.page",
  operator: "signin.actor.operator",
  client: "signin.actor.client",
};

export const SIGN_IN_STEPS: readonly SignInStep[] = [
  { id: "enter", actor: "you", glyph: "\u{1F511}", label: signin["signin.step.enter"], labelKey: "signin.step.enter", at: "begin" },
  { id: "ask", actor: "page", glyph: "\u{1F4E8}", label: signin["signin.step.ask"], labelKey: "signin.step.ask", at: "sending" },
  { id: "message", actor: "operator", glyph: "\u{1F4AC}", label: signin["signin.step.message"], labelKey: "signin.step.message", at: "awaiting" },
  { id: "approve", actor: "you", glyph: "\u2705", label: signin["signin.step.approve"], labelKey: "signin.step.approve", at: "awaiting" },
  { id: "reply", actor: "client", glyph: "\u21A9\uFE0F", label: signin["signin.step.reply"], labelKey: "signin.step.reply", at: "awaiting" },
  { id: "verify", actor: "you", glyph: "\u{1F446}", label: signin["signin.step.verify"], labelKey: "signin.step.verify", at: "awaiting" },
  { id: "check", actor: "operator", glyph: "\u{1F50D}", label: signin["signin.step.check"], labelKey: "signin.step.check", at: "checking" },
  { id: "token", actor: "operator", glyph: "\u{1F39F}\uFE0F", label: signin["signin.step.token"], labelKey: "signin.step.token", at: "checking" },
  { id: "unlock", actor: "page", glyph: "\u{1F513}", label: signin["signin.step.unlock"], labelKey: "signin.step.unlock", at: "done" },
];

const ORDER: readonly SignInStage[] = ["begin", "sending", "awaiting", "checking", "done"];

/** Whether `step` is behind, under way, or ahead of `stage`. */
export function stepState(step: SignInStep, stage: SignInStage): SignInStepState {
  const now = ORDER.indexOf(stage);
  const at = ORDER.indexOf(step.at);
  if (at < now) return "done";
  if (at === now) return "current";
  return "todo";
}

/** The gate's private stage and busy flag, read as one `SignInStage`. */
export function gateStage(stage: "begin" | "awaiting" | "checking", busy: boolean): SignInStage {
  if (stage === "begin") return busy ? "sending" : "begin";
  return stage;
}
