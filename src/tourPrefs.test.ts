import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { configureTollbooth } from "./config.ts";
import { setStoredNpub } from "./identity.ts";
import { markToured } from "./tour/state.ts";
import { onTourChange, readTourPrefs, settleTourPrefs, tourStorageKey, writeTourPrefs } from "./tourPrefs.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

describe("the tour preference, stored", () => {
  beforeEach(() => {
    store.clear();
    configureTollbooth({ slug: "chart", appName: "ChartRemotely", mcpUrl: "/mcp" });
  });

  it("lives under the site's prefix", () => {
    assert.equal(tourStorageKey(), "chart:tour:v1");
  });
  it("a device with nothing stored is new and on", () => {
    assert.equal(readTourPrefs().on, true);
  });
  it("a device that already held a patron npub is an old hand and off", () => {
    setStoredNpub("npub1old");
    assert.equal(readTourPrefs().on, false);
  });
  it("a newcomer who then signs in stays a newcomer, once settled", () => {
    assert.equal(settleTourPrefs().on, true);
    setStoredNpub("npub1new");
    assert.equal(readTourPrefs().on, true);
  });
  it("settling an old hand keeps them off", () => {
    setStoredNpub("npub1old");
    assert.equal(settleTourPrefs().on, false);
    assert.equal(readTourPrefs().on, false);
  });
  it("what is written is what is read, and the same object while unchanged", () => {
    const a = writeTourPrefs(markToured(readTourPrefs(), "plots"));
    assert.deepEqual(a.toured, { plots: true });
    assert.equal(readTourPrefs(), readTourPrefs());
    assert.equal(JSON.parse(store.get("chart:tour:v1")!).toured.plots, true);
  });
  it("tells listeners on the page", () => {
    let heard = 0;
    const stop = onTourChange(() => { heard++; });
    writeTourPrefs(markToured(readTourPrefs(), "x"));
    stop();
    writeTourPrefs(markToured(readTourPrefs(), "y"));
    assert.equal(heard, 1);
  });
  it("reads junk as the defaults", () => {
    store.set("chart:tour:v1", "{not json");
    assert.equal(readTourPrefs().on, true);
  });
});
