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

  it("takes a credential value whole even when it holds quotes", () => {
    const line = `update_patron_credential(${JSON.stringify({ field: "api_key", value: `it's "sk-live" 9` })})`;
    const out = redact(line);
    assert.equal(out, 'update_patron_credential({"field":"api_key","value":"[redacted]"})');
    assert.ok(!out.includes("sk-live") && !out.includes("s \\"));
  });

  it("scrubs a credential value cut off by the log's truncation", () => {
    const full = `update_patron_credential(${JSON.stringify({ field: "account_hash", value: "ABCDEFGH\\IJ" })})`;
    // Cut just after the first backslash of the escaped pair: a lone trailing `\`.
    const out = redact(full.slice(0, full.indexOf("\\") + 1));
    assert.ok(!out.includes("ABCD"), out);
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

describe("secrets inside URLs", () => {
  // Shapes, not secrets: built at run time.
  const FEED = "0123456789abcdef".repeat(2); // secrets.token_hex(16)
  const B64 = "Zk3q9XbT0pLw7RcV2yHn5MdA8sEf1GuJ-kOi4"; // token_urlsafe-like

  it("scrubs the Good Earth calendar feed token in both link forms", () => {
    const line = JSON.stringify({
      token: FEED,
      url: `https://goodearth.example/calendar/${FEED}.ics`,
      webcal_url: `webcal://goodearth.example/calendar/${FEED}.ics`,
    });
    const out = redact(line);
    assert.ok(!out.includes(FEED.slice(0, 12)), out);
    assert.match(out, /"url":"https:\/\/goodearth\.example\/calendar\/\[redacted\]\.ics"/);
    assert.match(out, /"webcal_url":"webcal:\/\/goodearth\.example\/calendar\/\[redacted\]\.ics"/);
  });

  it("scrubs a bearer-like base64url path segment and keeps the path's shape", () => {
    assert.equal(redact(`GET https://h.example/s/${B64}/view?x=1`), "GET https://h.example/s/[redacted]/view?x=1");
  });

  it("scrubs a feed URL inside JSON inside a JSON string", () => {
    const nested = JSON.stringify({ text: JSON.stringify({ url: `https://h.example/calendar/${FEED}.ics` }) });
    const out = redact(nested);
    assert.ok(!out.includes(FEED.slice(0, 12)), out);
    assert.match(out, /calendar\/\[redacted\]\.ics/);
  });

  it("scrubs secret-named query and fragment parameters, keeping the name", () => {
    const cases: [string, string][] = [
      ["https://h.example/cb?code=abc123&state=ok", "https://h.example/cb?code=[redacted]&state=ok"],
      ["https://h.example/p?page=2&sig=deadbeef", "https://h.example/p?page=2&sig=[redacted]"],
      ["https://h.example/#access_token=ya29.x&expires_in=3600", "https://h.example/#access_token=[redacted]&expires_in=3600"],
      ["https://h.example/a?KEY=k1&Session=s1&sessionid=s2", "https://h.example/a?KEY=[redacted]&Session=[redacted]&sessionid=[redacted]"],
      ["https://h.example/a?auth=a&pass=p&apikey=q&signature=g", "https://h.example/a?auth=[redacted]&pass=[redacted]&apikey=[redacted]&signature=[redacted]"],
      ["https://h.example/a?id_token=i&client_secret=c&proof=f", "https://h.example/a?id_token=[redacted]&client_secret=[redacted]&proof=[redacted]"],
    ];
    for (const [line, want] of cases) assert.equal(redact(line), want);
  });

  it("scrubs a URL-encoded value whole", () => {
    assert.equal(redact("https://h.example/cb?token=a%2Bb%2Fc%3D%3D&next=%2Fhome"), "https://h.example/cb?token=[redacted]&next=%2Fhome");
  });

  it("scrubs a value that runs to the end of a truncated line", () => {
    const full = `webhook → https://h.example/hook?signature=${"9f".repeat(20)}&t=1`;
    const cut = full.slice(0, full.indexOf("signature=") + 18);
    const out = redact(cut);
    assert.ok(out.endsWith("signature=[redacted]"), out);
    assert.ok(!out.includes("9f9f"), out);
  });

  it("scrubs userinfo and keeps the host", () => {
    assert.equal(redact("connect https://admin:hunter2@db.example:5432/x"), "connect https://[redacted]@db.example:5432/x");
    assert.equal(redact("wss://tok@relay.example"), "wss://[redacted]@relay.example");
  });

  it("scrubs before the client truncates, and a second pass changes nothing", () => {
    const line = `calendar_list → ${JSON.stringify({ feeds: [{ url: `https://h.example/calendar/${FEED}.ics` }] })}`;
    const cut = redact(line).slice(0, 60);
    assert.ok(!cut.includes(FEED.slice(0, 8)), cut);
    const once = redact('{"token":"x"} https://h.example/a?code=1 key=2 https://u:p@h.example/' + FEED);
    assert.equal(redact(once), once);
  });

  it("is applied by debugPush", () => {
    clearDebug();
    debugPush("result", `calendar_subscribe → {"url":"https://h.example/calendar/${FEED}.ics"}`);
    assert.ok(!debugLogText().includes(FEED.slice(0, 12)));
  });

  describe("leaves ordinary text alone", () => {
    const NPUB = "npub1" + "qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(2).slice(0, 58);
    const keep = [
      "https://goodearth.example/calendar",
      "https://example.com/blog/planting-window-for-early-tomatoes-in-zone-five",
      "https://example.com/items/12345/edit?page=2&sort=name&q=tomato",
      "https://api.example.com/v1/blocks/9b79617/items?kind=crop",
      `https://njump.me/${NPUB}`,
      "https://h.example/a?monkey=1&keyboard=2&passage=3&codec=4&tokens=5",
      "https://h.example/2026-09-25/report.ics",
      "https://github.com/lonniev/tollbooth-web/pull/15",
      "https://h.example/u/2026_09_25_harvest_report_final_v2",
      "goodearth_calendar_list → {\"success\":true,\"feeds\":[]}",
      "email a@b.example about https://h.example/x",
      "date 2026-09-25T12:00:00Z tool goodearth_frost_window",
      '{"success":false,"error_code":"proof_required"}',
    ];
    for (const line of keep) it(line, () => assert.equal(redact(line), line));
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
