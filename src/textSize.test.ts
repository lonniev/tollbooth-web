import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { configureTollbooth } from "./config.ts";
import { applyTextSize, readTextSize, textSizeStorageKey, writeTextSize, type TextSizeTarget } from "./textSize.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

function fakeRoot() {
  const attrs: Record<string, string> = {};
  const el: TextSizeTarget & { attrs: Record<string, string> } = {
    attrs,
    style: { fontSize: "" },
    setAttribute: (n, v) => void (attrs[n] = v),
  };
  return el;
}

describe("text size", () => {
  beforeEach(() => store.clear());

  it("reads standard when nothing, or nonsense, is stored", () => {
    assert.equal(readTextSize("site"), "standard");
    store.set(textSizeStorageKey("site"), "huge");
    assert.equal(readTextSize("site"), "standard");
  });

  it("keeps the pick per site prefix", () => {
    writeTextSize("site", "larger");
    assert.equal(readTextSize("site"), "larger");
    assert.equal(readTextSize("other"), "standard");
  });

  it("sets the root font size, and standard leaves the site's own", () => {
    const el = fakeRoot();
    applyTextSize("largest", el);
    assert.equal(el.style.fontSize, "150%");
    assert.equal(el.attrs["data-text-size"], "largest");
    applyTextSize("standard", el);
    assert.equal(el.style.fontSize, "");
  });

  it("configureTollbooth applies the stored pick", () => {
    const el = fakeRoot();
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: el } });
    writeTextSize("sized", "large");
    configureTollbooth({ slug: "sized", appName: "Sized" });
    assert.equal(el.style.fontSize, "112.5%");
    Reflect.deleteProperty(globalThis, "document");
  });
});
