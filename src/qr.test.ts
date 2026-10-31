import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceQrText, qrModules, qrPath } from "./qr.ts";

const INVOICE = `lnbc10u1p${"qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(10)}`;

test("an invoice becomes an uppercase lightning link, and anything else nothing", () => {
  assert.equal(invoiceQrText("lnbc10n1pxyz"), "LIGHTNING:LNBC10N1PXYZ");
  assert.equal(invoiceQrText("LNBC10N1PXYZ"), "LIGHTNING:LNBC10N1PXYZ");
  for (const bad of ["", null, undefined, "https://example.com", "lnbc 10", "javascript:alert(1)"]) {
    assert.equal(invoiceQrText(bad), null, String(bad));
  }
});

test("a long invoice fits a square code with its finder pattern", () => {
  const modules = qrModules(invoiceQrText(INVOICE)!);
  assert.equal(modules.length, modules[0].length);
  assert.ok(modules.length >= 21 && modules.length <= 177);
  assert.deepEqual(modules[0].slice(0, 7), [true, true, true, true, true, true, true]);
});

test("the path draws one square per dark module, inside its quiet zone", () => {
  assert.equal(qrPath([[true, false], [false, true]], 4), "M4 4h1v1h-1zM5 5h1v1h-1z");
});
