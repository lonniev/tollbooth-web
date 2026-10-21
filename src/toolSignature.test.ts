import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { schemaType, signatureLines, toolSignature, type JsonSchema } from "./toolSignature.ts";

// Shapes taken from goodearth's live `tools/list`.
const taskList: JsonSchema = {
  type: "object",
  properties: {
    region_id: { type: "string", description: "The saved region whose tasks to list." },
    timeframe: { type: "string", default: "all", description: "day, week, month, season or all." },
    page: { type: "integer", default: 0 },
    aliases: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }], default: null },
    npub: { type: "string", default: "" },
  },
  required: ["region_id"],
};

describe("toolSignature", () => {
  it("puts required parameters first, then the rest in schema order", () => {
    assert.deepEqual(
      toolSignature(taskList).map((p) => [p.name, p.required]),
      [["region_id", true], ["timeframe", false], ["page", false], ["aliases", false], ["npub", false]],
    );
  });

  it("carries type, default and description", () => {
    const [region, timeframe, page, aliases, npub] = toolSignature(taskList);
    assert.deepEqual(region, { name: "region_id", type: "string", required: true, description: "The saved region whose tasks to list." });
    assert.equal(timeframe.default, '"all"');
    assert.equal(page.default, "0");
    assert.equal(aliases.type, "string[] | null");
    assert.equal(aliases.default, "null");
    assert.equal(npub.default, '""');
    assert.equal(npub.description, undefined);
  });

  it("is empty for a tool that takes nothing, or no schema at all", () => {
    assert.deepEqual(toolSignature({ type: "object", properties: {} }), []);
    assert.deepEqual(toolSignature(undefined), []);
  });
});

describe("schemaType", () => {
  it("names enums, consts, unions and nested arrays", () => {
    assert.equal(schemaType({ enum: ["asc", "desc"] }), '"asc" | "desc"');
    assert.equal(schemaType({ const: 3 }), "3");
    assert.equal(schemaType({ type: ["string", "null"] }), "string | null");
    assert.equal(schemaType({ type: "array", items: { anyOf: [{ type: "string" }, { type: "integer" }] } }), "(string | integer)[]");
    assert.equal(schemaType({ anyOf: [{ type: "null" }, { type: "object" }] }), "object | null");
    assert.equal(schemaType({}), "any");
  });
});

describe("signatureLines", () => {
  it("writes one parameter a line, optional ones marked", () => {
    assert.deepEqual(signatureLines("goodearth_task_list", toolSignature(taskList)).slice(0, 3), [
      "goodearth_task_list(",
      "  region_id: string,",
      '  timeframe?: string = "all",',
    ]);
    assert.equal(signatureLines("x", toolSignature(taskList)).at(-1), ")");
  });

  it("closes on one line with no parameters", () => {
    assert.deepEqual(signatureLines("goodearth_block_list", []), ["goodearth_block_list()"]);
  });
});
