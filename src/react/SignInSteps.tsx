/**
 * The sequence under the sign-in card: what happens, who does it, and which
 * step is under way now — read from the gate's real stage, never guessed.
 *
 * Mechanics only. It renders an ordered list with `data-state` on each step
 * (`done` / `current` / `todo`) and `aria-current="step"` on the ones under
 * way; every class is the site's through `classNames`. Without them the
 * markup is plain and inherits from the page.
 */

import { cx } from "./cx.ts";
import {
  SIGN_IN_ACTORS,
  SIGN_IN_STEPS,
  stepState,
  type SignInActor,
  type SignInStage,
  type SignInStep,
} from "./signInFlow.ts";

export interface SignInStepsClassNames {
  root?: string;
  step?: string;
  /** Added to a step by its state. */
  done?: string;
  current?: string;
  todo?: string;
  /** The step number. */
  index?: string;
  /** Who acts. */
  actor?: string;
  label?: string;
}

export interface SignInStepsProps {
  stage: SignInStage;
  /** Default: the package's nine. */
  steps?: readonly SignInStep[];
  /** Names for the actors. Default: You / This page / The operator / Your Nostr client. */
  actors?: Readonly<Record<SignInActor, string>>;
  /** Accessible name of the list. Default "How signing in works". */
  label?: string;
  classNames?: SignInStepsClassNames;
}

export default function SignInSteps({
  stage,
  steps = SIGN_IN_STEPS,
  actors = SIGN_IN_ACTORS,
  label = "How signing in works",
  classNames: c = {},
}: SignInStepsProps) {
  return (
    <ol aria-label={label} className={c.root}>
      {steps.map((s, i) => {
        const state = stepState(s, stage);
        return (
          <li
            key={s.id}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={cx(c.step, c[state])}
          >
            <span aria-hidden className={c.index}>
              {i + 1}
            </span>
            <span className={c.actor}>{actors[s.actor]}</span>
            <span className={c.label}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
