/**
 * The state the shell used to call "signed in".
 *
 * A person pasted an npub, pressed Send proof DM, and never answered it. The
 * npub was already in storage — put there so the field would be prefilled —
 * and the shell asked only whether an npub was known. It let them in.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { canSignFor, isProven } from "./signedIn.ts";

const NPUB = "npub1yp8zlyv88cmxazp5zl307s97dv6vszgrcgnc";
const OTHER = "npub1d999638crq64z";

test("a DM that was sent and never answered is not a sign-in", () => {
  assert.equal(isProven({ npub: NPUB, held: false, sessionNpub: null }), false);
});

test("a session key proves the npub it derives to, and no other", () => {
  assert.equal(isProven({ npub: NPUB, held: false, sessionNpub: NPUB }), true);
  assert.equal(
    isProven({ npub: NPUB, held: false, sessionNpub: OTHER }),
    false,
    "a key left from a previous identity proves nothing about this one",
  );
});

test("no npub is no session, whatever else is lying around", () => {
  assert.equal(isProven({ npub: "", held: false, sessionNpub: OTHER }), false);
});

test("signing for yourself is narrower than being proven", () => {
  // Living on a proof the operator holds is a real session; it just cannot
  // sign, which is the distinction the pages that spend money have to make.
  const held = { npub: NPUB, held: true, sessionNpub: null };
  assert.equal(isProven(held), true);
  assert.equal(canSignFor(held), false);
});

test("an npub this tab's holder connection holds is proven", () => {
  assert.equal(isProven({ npub: NPUB, held: true, sessionNpub: null }), true);
  assert.equal(isProven({ npub: "", held: true, sessionNpub: null }), false);
});
