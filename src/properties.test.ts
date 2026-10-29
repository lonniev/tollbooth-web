import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { configureTollbooth } from "./config.ts";
import { setStoredNpub } from "./identity.ts";
import {
  answerPropertyTools,
  asText,
  onPropertyChange,
  readProperty,
  syncProperties,
  writeProperty,
  type PropertyInfo,
} from "./properties.ts";
import { readTimezonePref, writeTimezonePref } from "./timezone.ts";
import { readTourPrefs, writeTourPrefs } from "./tourPrefs.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
});

const NPUB = "npub1patron";

function spec(name: string, follows: "account" | "device", dflt: unknown, value?: unknown): PropertyInfo {
  return {
    name, kind: "text", label: name, description: "", default: dflt, follows,
    value: value === undefined ? dflt : value, is_default: value === undefined, updated_at: "",
  };
}

/** A server holding `account`, recording what is written to it. */
function server(account: Record<string, unknown>, declared: PropertyInfo[]) {
  const sets: [string, string][] = [];
  answerPropertyTools({
    get: async () => ({
      success: true,
      properties: declared.map((p) =>
        p.follows === "account" && p.name in account ? { ...p, value: account[p.name], is_default: false } : p),
    }),
    set: async (name, value) => {
      sets.push([name, value]);
      account[name] = value;
      return { success: true };
    },
  });
  return sets;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("properties", () => {
  beforeEach(() => {
    store.clear();
    configureTollbooth({ slug: "ge", appName: "Good Earth", mcpUrl: "/mcp" });
  });

  it("reads the local copy, then the declared default, then the fallback", async () => {
    assert.equal(readProperty("units", "F"), "F");
    server({}, [spec("units", "account", "C")]);
    await syncProperties(NPUB);
    assert.equal(readProperty("units", "F"), "C");
    writeProperty("units", "K");
    assert.equal(readProperty("units", "F"), "K");
  });

  it("the account's value wins on sign-in", async () => {
    writeProperty("units", "F");
    setStoredNpub(NPUB);
    store.set(`ge:prop-synced:${NPUB}`, "earlier");
    const sets = server({ units: "C" }, [spec("units", "account", "F")]);
    let heard = 0;
    const stop = onPropertyChange("units", () => heard++);
    await syncProperties(NPUB);
    stop();
    assert.equal(readProperty("units", "F"), "C");
    assert.equal(heard, 1);
    assert.deepEqual(sets, []);
  });

  it("the first sign-in on a device writes a choice the account lacks up, once", async () => {
    writeProperty("units", "C");
    setStoredNpub(NPUB);
    const account: Record<string, unknown> = {};
    const sets = server(account, [spec("units", "account", "F")]);
    await syncProperties(NPUB);
    assert.deepEqual(sets, [["units", "C"]]);
    assert.equal(account.units, "C");
  });

  it("after the first sign-in, an account back at its default brings the device with it", async () => {
    writeProperty("units", "C");
    setStoredNpub(NPUB);
    store.set(`ge:prop-synced:${NPUB}`, "earlier");
    const sets = server({}, [spec("units", "account", "F")]);
    await syncProperties(NPUB);
    assert.equal(readProperty("units", "F"), "F");
    assert.deepEqual(sets, []);
  });

  it("a device property never reaches the server", async () => {
    setStoredNpub(NPUB);
    const sets = server({}, [spec("bees", "device", true)]);
    await syncProperties(NPUB);
    writeProperty("bees", false);
    await tick();
    assert.deepEqual(sets, []);
    assert.equal(readProperty("bees", true), false);
  });

  it("an account property set after sign-in is kept with the account", async () => {
    setStoredNpub(NPUB);
    const sets = server({}, [spec("units", "account", "F")]);
    await syncProperties(NPUB);
    writeProperty("units", "C");
    await tick();
    assert.deepEqual(sets, [["units", "C"]]);
  });

  it("signed out, everything stays local", async () => {
    const sets = server({}, [spec("units", "account", "F")]);
    await syncProperties(NPUB);
    setStoredNpub("");
    writeProperty("units", "C");
    await tick();
    assert.deepEqual(sets, []);
  });

  it("a server that cannot answer leaves the local copies alone", async () => {
    writeProperty("units", "C");
    answerPropertyTools({
      get: async () => { throw new Error("offline"); },
      set: async () => ({ success: true }),
    });
    await syncProperties(NPUB);
    assert.equal(readProperty("units", "F"), "C");
  });

  it("the time zone and the tour switch keep their own storage and follow the account", async () => {
    setStoredNpub(NPUB);
    store.set(`ge:prop-synced:${NPUB}`, "earlier");
    const sets = server({ timezone: "Europe/London", tour: false },
      [spec("timezone", "account", "auto"), spec("tour", "account", true)]);
    await syncProperties(NPUB);
    assert.equal(readTimezonePref(), "Europe/London");
    assert.equal(readTourPrefs().on, false);

    writeTimezonePref("Asia/Tokyo");
    writeTourPrefs({ ...readTourPrefs(), on: true });
    writeTourPrefs({ ...readTourPrefs(), toured: { home: true } });  // pages toured stay here
    await tick();
    assert.deepEqual(sets, [["timezone", "Asia/Tokyo"], ["tour", "true"]]);
  });

  it("text goes as it is and anything else as JSON", () => {
    assert.equal(asText("C"), "C");
    assert.equal(asText(false), "false");
    assert.equal(asText(["gdd", "rain"]), "[\"gdd\",\"rain\"]");
  });
});
