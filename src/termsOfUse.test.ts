import { test } from "node:test";
import assert from "node:assert/strict";
import { termsOfUse } from "./termsOfUse.ts";

const own = [{ title: "The service", says: ["It is provided as is."] }];

test("a site's own sections come first, then the shared ones in order", () => {
  const titles = termsOfUse({ name: "FieldData", own, cafe: true }).map((s) => s.title);
  assert.deepEqual(titles, ["The service", "Your key to the account", "Fees", "The Catalog", "Marks"]);
});

test("the Catalog section is there only for a site that shows it, and names the site", () => {
  assert.ok(!termsOfUse({ name: "X", own }).some((s) => s.title === "The Catalog"));
  const cat = termsOfUse({ name: "CommissionMarket", own, cafe: true }).find((s) => s.title === "The Catalog");
  assert.match(cat!.says[0], /CommissionMarket takes no orders/);
});

test("the site's marks follow the DPYC marks", () => {
  const marks = termsOfUse({ name: "X", own, marks: ["Ecowitt is a trademark of its owner."] }).at(-1)!;
  assert.match(marks.says[0], /DPYC™/);
  assert.equal(marks.says[1], "Ecowitt is a trademark of its owner.");
});

test("payments are final, and the fees section says so", () => {
  const fees = termsOfUse({ name: "X", own }).find((s) => s.title === "Fees")!;
  assert.ok(fees.says.some((l) => /payments are final/i.test(l)));
});

test("a site cannot write a shared section twice, or an empty one", () => {
  assert.throws(() => termsOfUse({ name: "X", own: [{ title: "Fees", says: ["x"] }] }), /shared section/);
  assert.throws(() => termsOfUse({ name: "X", own: [{ title: "Empty", says: [] }] }), /says nothing/);
  assert.throws(() => termsOfUse({ name: " ", own }), /name/);
});
