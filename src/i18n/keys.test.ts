import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import { en } from "./en.ts";
import { baseKey, pluralBases } from "./parity.ts";

/** Every source file the package ships, apart from the words themselves. */
function sources(dir: URL): { path: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const at = new URL(name, dir);
    if (statSync(at).isDirectory()) return name === "i18n" ? [] : sources(new URL(`${name}/`, dir));
    if (!/\.tsx?$/.test(name) || name.endsWith(".test.ts")) return [];
    return [{ path: at.pathname, text: readFileSync(at, "utf8") }];
  });
}

const files = sources(new URL("../", import.meta.url));
const plurals = pluralBases(en);
const known = new Set(Object.keys(en).map((k) => baseKey(k, plurals)));

test("every key the code asks for is in English", () => {
  const asked = /\b(?:t|translate)\(\s*"([^"]+)"|\bk="([^"]+)"/g;
  let calls = 0;
  for (const { path, text } of files) {
    for (const m of text.matchAll(asked)) {
      calls++;
      const key = m[1] ?? m[2];
      assert.ok(known.has(key), `${path} asks for "${key}", which en.ts lacks`);
    }
  }
  assert.ok(calls > 100, `only ${calls} calls found: the pattern no longer matches how the code asks`);
});

test("every English key is asked for somewhere", () => {
  const all = files.map((f) => f.text).join("\n");
  const idle = [...known].filter((key) => !all.includes(`"${key}"`));
  assert.deepEqual(idle, []);
});

test("no key is asked for by a built-up name", () => {
  for (const { path, text } of files) {
    assert.doesNotMatch(text, /\b(?:t|translate)\(\s*`/, `${path} builds a key from a template`);
  }
});
