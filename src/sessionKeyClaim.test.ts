import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  passwordManagerOutcomeLabel,
  sessionKeyClaimVisible,
  sessionKeyEnvContents,
  sessionKeyEnvFilename,
} from "./sessionKeyClaim.ts";

const NPUB_A = "npub16qarmz80zwag03nhvgz67903glq9qams632834zy4h3ha3klfycqyn35wf";
const NPUB_B = "npub1sn0wdenkukak0d9dfczze4k2vx40yxj6q9aspp6t30mmgpz44yfs7s8f0w";

describe("who is offered the session key", () => {
  it("a browser holding the key for the signed-in npub", () => {
    assert.equal(
      sessionKeyClaimVisible({ hasSessionNsec: true, sessionNsecNpub: NPUB_A, signedInNpub: NPUB_A }),
      true,
    );
  });

  it("nobody signed in with NIP-07 or a courier proof", () => {
    assert.equal(
      sessionKeyClaimVisible({ hasSessionNsec: false, sessionNsecNpub: null, signedInNpub: NPUB_A }),
      false,
    );
  });

  it("nobody whose held key belongs to another npub", () => {
    assert.equal(
      sessionKeyClaimVisible({ hasSessionNsec: true, sessionNsecNpub: NPUB_B, signedInNpub: NPUB_A }),
      false,
    );
  });

  it("nobody when either npub is missing", () => {
    assert.equal(
      sessionKeyClaimVisible({ hasSessionNsec: true, sessionNsecNpub: NPUB_A, signedInNpub: "" }),
      false,
    );
    assert.equal(
      sessionKeyClaimVisible({ hasSessionNsec: true, sessionNsecNpub: null, signedInNpub: NPUB_A }),
      false,
    );
  });
});

describe("the .env hand-off", () => {
  it("names the variable and the file after the site", () => {
    const nsec = "nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsr4j00";
    assert.equal(sessionKeyEnvContents("goodearth", nsec), `GOODEARTH_NSEC=${nsec}\n`);
    assert.equal(sessionKeyEnvFilename("chart"), "chart-nsec.env");
  });
});

describe("the password-manager destination", () => {
  it("never claims an OS keychain write", () => {
    for (const o of ["stored", "prompted", "unsupported"] as const) {
      const label = passwordManagerOutcomeLabel(o);
      assert.doesNotMatch(label, /stored (it )?in (an? )?(OS )?keychain/i);
      assert.doesNotMatch(label, /wrote to (the )?(OS )?keychain/i);
      assert.doesNotMatch(label, /saved to (Keychain|libsecret|Credential Manager)/i);
      assert.ok(label.length > 0);
    }
    assert.match(passwordManagerOutcomeLabel("prompted"), /cannot do that/i);
  });
});

describe("the SessionKeyClaim card", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "react/SessionKeyClaim.tsx"),
    "utf8",
  );

  it("renders nothing unless the visibility rule allows it", () => {
    assert.match(src, /sessionKeyClaimVisible/);
    assert.match(src, /return null/);
  });

  it("takes a deliberate step before the key is shown or used", () => {
    assert.match(src, /Claim your session key/);
    assert.match(src, /"Reveal"/);
    // The key is painted only behind the Reveal toggle.
    assert.match(src, /\{showKey && \(/);
    assert.match(src, /const \[showKey, setShowKey\] = useState\(false\)/);
  });

  it("never logs the key", () => {
    assert.doesNotMatch(src, /console\.(log|debug|info|warn|error)\([^)]*nsec/i);
    assert.doesNotMatch(src, /debugPush\([^)]*[Nn]sec/);
  });
});
