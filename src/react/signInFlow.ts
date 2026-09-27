/**
 * The pure half of `SignInSteps` (named apart from it: the filesystem is case-blind): what happens when someone signs in, in the
 * order it happens, and which step is under way for a given gate stage.
 *
 * Nine steps, four actors. The words are the visitor's, not the protocol's:
 * "the operator" (never MCP), "a proof" (never dpop), "this page" (never FE).
 * A site may pass its own list to `SignInSteps`; this one is the default.
 */

/** Where the gate stands. `sending` is `begin` with a request in flight. */
export type SignInStage = "begin" | "sending" | "awaiting" | "checking" | "done";

export type SignInActor = "you" | "page" | "operator" | "client";

export interface SignInStep {
  id: string;
  actor: SignInActor;
  /** Short, on screen. */
  label: string;
  /** The stage during which this step is the one under way. */
  at: SignInStage;
}

export type SignInStepState = "done" | "current" | "todo";

export const SIGN_IN_ACTORS: Readonly<Record<SignInActor, string>> = {
  you: "You",
  page: "This page",
  operator: "The operator",
  client: "Your Nostr client",
};

export const SIGN_IN_STEPS: readonly SignInStep[] = [
  { id: "enter", actor: "you", label: "Enter your npub", at: "begin" },
  { id: "ask", actor: "page", label: "Asks the operator for a proof", at: "sending" },
  { id: "message", actor: "operator", label: "Sends a message to your Nostr client", at: "awaiting" },
  { id: "approve", actor: "you", label: "Approve it, for as long as you choose", at: "awaiting" },
  { id: "reply", actor: "client", label: "Your signed reply travels back", at: "awaiting" },
  { id: "verify", actor: "you", label: "Tap Verify", at: "awaiting" },
  { id: "check", actor: "operator", label: "Checks your signature", at: "checking" },
  { id: "token", actor: "operator", label: "Hands this page a proof", at: "checking" },
  { id: "unlock", actor: "page", label: "Unlocks", at: "done" },
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
