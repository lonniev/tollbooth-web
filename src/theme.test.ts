import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { configureTollbooth } from "./config.ts";
import {
  applyTheme,
  bootstrapTheme,
  nextTheme,
  parseTheme,
  readTheme,
  resolveTheme,
  themeStorageKey,
  writeTheme,
  type ThemeTarget,
} from "./theme.ts";

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
  const classes = new Set<string>();
  const attrs: Record<string, string> = {};
  const el: ThemeTarget & { classes: Set<string>; attrs: Record<string, string> } = {
    classes,
    attrs,
    classList: {
      toggle(token: string, force?: boolean) {
        if (force ?? !classes.has(token)) classes.add(token);
        else classes.delete(token);
      },
    },
    setAttribute: (n, v) => void (attrs[n] = v),
    style: { colorScheme: "" },
  };
  return el;
}

describe("theme persistence", () => {
  beforeEach(() => {
    store.clear();
    configureTollbooth({ slug: "cypher", appName: "Cypher", mcpUrl: "/mcp" });
  });

  it("keeps the pick under <prefix>:theme", () => {
    assert.equal(themeStorageKey(), "cypher:theme");
    writeTheme("light");
    assert.equal(store.get("cypher:theme"), "light");
    assert.equal(readTheme(), "light");
  });

  it("honours a site's storagePrefix", () => {
    configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp", storagePrefix: "cr" });
    writeTheme("system");
    assert.equal(store.get("cr:theme"), "system");
  });

  it("falls back when nothing, or nonsense, is stored", () => {
    assert.equal(readTheme(), "dark");
    assert.equal(readTheme("light"), "light");
    store.set("cypher:theme", "purple");
    assert.equal(readTheme(), "dark");
    assert.equal(parseTheme(null, "system"), "system");
  });

  it("survives storage that throws", () => {
    const saved = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      assert.equal(readTheme("light"), "light");
      assert.doesNotThrow(() => writeTheme("dark"));
    } finally {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, value: saved });
    }
  });
});

describe("applying a theme", () => {
  it("resolves system from the OS preference", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
  });

  it("sets the dark class, data-theme and color-scheme together", () => {
    const el = fakeRoot();
    assert.equal(applyTheme("dark", el), "dark");
    assert.ok(el.classes.has("dark"));
    assert.equal(el.attrs["data-theme"], "dark");
    assert.equal(el.style.colorScheme, "dark");
    applyTheme("system", el, false);
    assert.ok(!el.classes.has("dark"));
    assert.equal(el.attrs["data-theme"], "light");
    assert.equal(el.style.colorScheme, "light");
  });

  it("bootstraps from storage without a DOM", () => {
    store.clear();
    configureTollbooth({ slug: "roastify", appName: "Roastify", mcpUrl: "/mcp" });
    store.set("roastify:theme", "light");
    assert.equal(bootstrapTheme(), "light");
  });

  it("cycles through the offered picks", () => {
    assert.equal(nextTheme("dark"), "light");
    assert.equal(nextTheme("light"), "system");
    assert.equal(nextTheme("system"), "dark");
    assert.equal(nextTheme("light", ["dark", "light"]), "dark");
  });
});
