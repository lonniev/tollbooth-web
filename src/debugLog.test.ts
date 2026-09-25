import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearDebug,
  configureDebugLog,
  debugEntries,
  debugLogText,
  debugPush,
  debugSeverity,
  onDebug,
  redact,
} from "./debugLog.ts";

// A shape, not a key: bech32 characters in nsec length, built at run time.
const NSEC = "nsec1" + "qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(2).slice(0, 58);
const HEX = "a".repeat(32) + "0123456789abcdef".repeat(2);

describe("redaction", () => {
  it("scrubs an nsec wherever it appears", () => {
    const out = redact(`claimed ${NSEC} ok`);
    assert.doesNotMatch(out, /nsec1q/);
    assert.match(out, /claimed \[redacted\] ok/);
  });

  it("scrubs a 64-hex key and a 128-hex signature", () => {
    assert.equal(redact(`key ${HEX}`), "key [redacted]");
    assert.equal(redact(`sig ${HEX}${HEX}`), "sig [redacted]");
  });

  it("scrubs the value of secret-named fields in JSON", () => {
    const out = redact(
      JSON.stringify({ npub: "npub1abc", dpop_token: "tok-123", proof: "p-9", poison: "blue fox", api_key: "sk-1" }),
    );
    for (const secret of ["tok-123", "p-9", "blue", "sk-1"]) assert.ok(!out.includes(secret), `${secret} leaked: ${out}`);
    assert.match(out, /"npub":"npub1abc"/);
  });

  it("scrubs JSON nested inside a JSON string, a query string, and a repr", () => {
    const nested = JSON.stringify({ text: JSON.stringify({ access_token: "xyz789" }) });
    assert.ok(!redact(nested).includes("xyz789"));
    assert.ok(!redact("GET /cb?refresh_token=r1r1&state=s").includes("r1r1"));
    assert.ok(!redact("{'password': 'hunter2'}").includes("hunter2"));
    assert.ok(!redact("Authorization: Bearer abc.def.ghi").includes("abc.def"));
  });

  it("takes a quoted value whole, spaces and all", () => {
    assert.equal(redact('{"poison":"blue fox jumps"}'), '{"poison":"[redacted]"}');
  });

  it("scrubs the value a credential update carries beside its field name", () => {
    const out = redact('update_patron_credential({"field":"api_key","value":"sk live 1"})');
    assert.equal(out, 'update_patron_credential({"field":"api_key","value":"[redacted]"})');
    assert.equal(redact('{"value":42}'), '{"value":42}');
  });

  it("leaves error codes that merely name a secret alone", () => {
    const line = '{"success":false,"error_code":"dpop_token_missing","tokens_used":5}';
    assert.equal(redact(line), line);
  });

  it("is applied by debugPush, so the store and Copy never hold a secret", () => {
    clearDebug();
    debugPush("call", `receive_npub_proof({"dpop_token":"secret-phrase","nsec":"${NSEC}"})`);
    const text = debugLogText();
    assert.ok(!text.includes("secret-phrase"));
    assert.ok(!text.includes(NSEC));
    assert.ok(!debugEntries()[0].message.includes(NSEC));
  });
});

describe("the ring buffer", () => {
  it("keeps newest first and drops the oldest past the cap", () => {
    configureDebugLog({ max: 3 });
    clearDebug();
    for (const n of [1, 2, 3, 4, 5]) debugPush("info", `m${n}`);
    assert.deepEqual(debugEntries().map((e) => e.message), ["m5", "m4", "m3"]);
    configureDebugLog({ max: 200 });
  });

  it("rejects a nonsense cap", () => {
    assert.throws(() => configureDebugLog({ max: 0 }));
  });

  it("hands out a new array on change and the same one otherwise", () => {
    clearDebug();
    const a = debugEntries();
    assert.equal(debugEntries(), a);
    debugPush("info", "x");
    assert.notEqual(debugEntries(), a);
  });

  it("notifies subscribers until they unsubscribe", () => {
    let calls = 0;
    const off = onDebug(() => calls++);
    debugPush("info", "one");
    clearDebug();
    assert.equal(calls, 2);
    off();
    debugPush("info", "two");
    assert.equal(calls, 2);
  });

  it("clear empties the log", () => {
    debugPush("info", "x");
    clearDebug();
    assert.equal(debugEntries().length, 0);
    assert.equal(debugLogText(), "");
  });
});

describe("severity", () => {
  it("tells a fault from a step the patron takes", () => {
    const e = (type: "info" | "call" | "result" | "error", message: string) => ({ ts: "", type, message });
    assert.equal(debugSeverity(e("error", "boom")), "failure");
    assert.equal(debugSeverity(e("result", '{"success":false,"error_code":"insufficient_balance"}')), "notice");
    assert.equal(debugSeverity(e("error", 'x → {"success":false,"error_code":"PROOF_REQUIRED"}')), "notice");
    assert.equal(debugSeverity(e("result", '{"ok":true}')), "ok");
    assert.equal(debugSeverity(e("call", 'tool({"error":1})')), "ok");
  });
});

describe("the DebugPanel", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "react/DebugPanel.tsx"), "utf8");

  it("renders only what the scrubbed store holds", () => {
    assert.match(src, /useDebugLog\(\)/);
    assert.match(src, /debugLogText\(\)/);
    assert.doesNotMatch(src, /getSessionNsec|dpop_token|proofFor|readStoredProof/);
    assert.doesNotMatch(src, /console\.(log|debug|info|warn|error)/);
  });

  it("colours only through theme tokens", () => {
    const classes = src.match(/(?:bg|text|border)-\[[^\]]+\]/g) ?? [];
    assert.ok(classes.length > 0);
    for (const c of classes) assert.match(c, /\[var\(--tb-[a-z0-9-]+\)\]|\[40vh\]/, c);
    assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b|\b(?:zinc|stone|red|purple|sky|amber|green)-\d/);
  });

  it("gives every control a 40px tap target and no hover-only affordance", () => {
    assert.match(src, /min-h-10 min-w-10/);
    assert.doesNotMatch(src, /group-hover|hover:(?:block|flex|opacity)/);
  });
});
