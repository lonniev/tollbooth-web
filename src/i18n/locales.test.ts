import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { en } from "./en.ts";
import { isLanguage } from "./languages.ts";
import { localeProblems, placeholders, tags } from "./parity.ts";

const dir = new URL("./locales/", import.meta.url);
const files = readdirSync(dir).filter((f) => /\.ts$/.test(f) && !f.endsWith(".test.ts"));
// The loaders as code: the comment above them shows an example line.
const loaders = readFileSync(new URL("./loaders.ts", import.meta.url), "utf8").replace(/^\s*(\/\*|\*|\/\/).*$/gm, "");

test("the parity rule catches each way a translation can drift", () => {
  const english = { "a.hi": "Hi {{name}}", "a.n_one": "{{count}} use", "a.n_other": "{{n}} of {{count}} uses", "a.b": "Tap <b>here</b>" };
  const sound = { "a.hi": "Salut {{name}}", "a.n_one": "{{count}} emploi", "a.n_many": "{{n}} de {{count}} emplois", "a.n_other": "{{n}} sur {{count}} emplois", "a.b": "<b>Ici</b>" };
  assert.deepEqual(localeProblems(english, sound), []);
  const { "a.n_other": _other, ...noOther } = sound;
  assert.deepEqual(localeProblems(english, noOther), ["needs a.n_other"]);
  const { "a.hi": _gone, ...short } = sound;
  assert.deepEqual(localeProblems(english, short), ["missing: a.hi"]);
  assert.deepEqual(localeProblems(english, { ...sound, "a.extra": "x" }), ["not in English: a.extra"]);
  assert.match(localeProblems(english, { ...sound, "a.hi": "Salut {{nom}}" })[0], /^placeholders differ: a\.hi/);
  assert.match(localeProblems(english, { ...sound, "a.n_other": "{{count}} emplois" })[0], /^placeholders differ: a\.n_other/);
  assert.deepEqual(localeProblems(english, { ...sound, "a.b": "Ici" }), ["tags differ: a.b"]);
  assert.deepEqual(localeProblems(english, { ...sound, "a.hi": " " }), ["empty: a.hi"]);
  // Japanese has one form: `_other` alone is whole.
  const { "a.n_one": _one, "a.n_many": _many, ...oneForm } = sound;
  assert.deepEqual(localeProblems(english, oneForm), []);
  assert.deepEqual(placeholders("{{b}} and {{ a }} and {{b}}"), ["a", "b"]);
  assert.deepEqual(tags("<a>x</a> <br/>"), ["a", "br"]);
});

test("English names every count's variables in its `_other` form", () => {
  const words: Record<string, string> = en;
  for (const key of Object.keys(words)) {
    if (key.endsWith("_one")) {
      const other = `${key.slice(0, -"_one".length)}_other`;
      assert.ok(other in words, `${key} has no ${other}`);
      for (const p of placeholders(words[key])) assert.ok(placeholders(words[other]).includes(p), `${key}: {{${p}}} is not in ${other}`);
    }
    if (key.endsWith("_other")) assert.ok(`${key.slice(0, -"_other".length)}_one` in words, `${key} has no _one`);
    assert.ok(words[key].trim(), `${key} is empty`);
  }
});

// Zero files today. Each one a translator adds is held to English from then on.
for (const file of files) {
  const code = file.replace(/\.ts$/, "");
  test(`locales/${file} matches English`, async () => {
    assert.ok(isLanguage(code) && code !== "en", `${code} is not one of the package's languages`);
    assert.ok(loaders.includes(`import("./locales/${file}")`), `loaders.ts has no line for ${file}`);
    const mod = (await import(new URL(file, dir).href)) as { default?: Record<string, unknown> };
    assert.ok(mod.default && typeof mod.default === "object", `${file} must export default its words`);
    assert.deepEqual(localeProblems(en, mod.default), []);
  });
}

test("every language loaders.ts names has its file", () => {
  const named = [...loaders.matchAll(/import\("\.\/locales\/([\w-]+\.ts)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(named, [...files].sort());
});
