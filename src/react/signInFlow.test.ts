/**
 * The sign-in strip must tell the truth about where the flow stands: every
 * stage lights at least one step, steps light in order and never go dark
 * again, and a finished sign-in has nothing left to do.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gateStage, SIGN_IN_ACTORS, SIGN_IN_STEPS, stepState, type SignInStage } from "./signInFlow.ts";

const STAGES: SignInStage[] = ["begin", "sending", "awaiting", "checking", "done"];

describe("the nine steps", () => {
  it("are nine, each with an actor the strip can name", () => {
    assert.equal(SIGN_IN_STEPS.length, 9);
    for (const s of SIGN_IN_STEPS) assert.ok(SIGN_IN_ACTORS[s.actor], `${s.id} has an unnamed actor`);
  });

  it("each carry one glyph and a label of at most four words", () => {
    for (const s of SIGN_IN_STEPS) {
      assert.ok(s.glyph.length > 0, `${s.id} has no glyph`);
      assert.ok([...new Intl.Segmenter().segment(s.glyph)].length === 1, `${s.id}: one emoji, not ${s.glyph}`);
      assert.ok(s.label.split(" ").length <= 4, `${s.id}: ${s.label}`);
    }
  });

  it("never say the protocol's words on screen", () => {
    for (const s of SIGN_IN_STEPS) {
      assert.doesNotMatch(s.label, /\b(MCP|dpop|FE|DM|courier|token)\b/i, `${s.id}: ${s.label}`);
    }
  });

  it("are ordered by stage, so the strip reads top to bottom", () => {
    let last = -1;
    for (const s of SIGN_IN_STEPS) {
      const i = STAGES.indexOf(s.at);
      assert.ok(i >= last, `${s.id} is out of order`);
      last = i;
    }
  });
});

describe("which step is under way", () => {
  it("lights at least one step at every stage", () => {
    for (const stage of STAGES) {
      assert.ok(SIGN_IN_STEPS.some((s) => stepState(s, stage) === "current"), `nothing lit at ${stage}`);
    }
  });

  it("starts with only 'enter your npub' lit", () => {
    const lit = SIGN_IN_STEPS.filter((s) => stepState(s, "begin") === "current").map((s) => s.id);
    assert.deepEqual(lit, ["enter"]);
    assert.ok(SIGN_IN_STEPS.every((s) => stepState(s, "begin") !== "done"));
  });

  it("while the message is out, the human's part is what is lit", () => {
    const lit = SIGN_IN_STEPS.filter((s) => stepState(s, "awaiting") === "current").map((s) => s.id);
    assert.deepEqual(lit, ["message", "approve", "reply", "verify"]);
    assert.equal(stepState(SIGN_IN_STEPS[0], "awaiting"), "done");
    assert.equal(stepState(SIGN_IN_STEPS[8], "awaiting"), "todo");
  });

  it("a done step never goes dark again as the stage advances", () => {
    for (const s of SIGN_IN_STEPS) {
      let seenDone = false;
      for (const stage of STAGES) {
        const st = stepState(s, stage);
        if (seenDone) assert.equal(st, "done", `${s.id} went ${st} after done at ${stage}`);
        if (st === "done") seenDone = true;
      }
    }
  });

  it("at the end only 'unlocks' is current and everything else is done", () => {
    for (const s of SIGN_IN_STEPS) {
      assert.equal(stepState(s, "done"), s.id === "unlock" ? "current" : "done");
    }
  });
});

describe("reading the gate's stage", () => {
  it("is 'sending' only while a request is in flight from the first screen", () => {
    assert.equal(gateStage("begin", false), "begin");
    assert.equal(gateStage("begin", true), "sending");
    assert.equal(gateStage("awaiting", true), "awaiting", "a resend keeps the human's part lit");
    assert.equal(gateStage("checking", true), "checking");
  });
});
