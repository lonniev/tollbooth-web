import assert from "node:assert/strict";
import { test } from "node:test";
import { en } from "./en.ts";
import { LOCALE_LOADERS } from "./loaders.ts";
import {
  LANGUAGES,
  content,
  getLanguage,
  languageLocale,
  onLanguageChange,
  registerNamespace,
  setLanguage,
  startLanguage,
  translate,
} from "./index.ts";

// One instance for the file, as in a page: the tests run in order and each
// leaves the language where the next expects it.

test("English is there before anything is asked for", () => {
  assert.equal(getLanguage(), "en");
  assert.equal(translate("language.label"), en["language.label"]);
});

test("a guest with no stored choice and no known country starts in English", async () => {
  // Node has no page origin to ask for a country, and no localStorage.
  await startLanguage();
  assert.equal(getLanguage(), "en");
});

test("a site's namespace is read in English at once, with variables and plurals", async () => {
  let fetched = 0;
  await registerNamespace(
    "farm",
    { "greet": "Hello {{name}}", "cows_one": "{{count}} cow", "cows_other": "{{count}} cows", "onlyEnglish": "Barn" },
    {
      fr: async () => {
        fetched++;
        return { default: { "greet": "Bonjour {{name}}", "cows_one": "{{count}} vache", "cows_other": "{{count}} vaches" } };
      },
    },
  );
  assert.equal(fetched, 0, "nothing is fetched while the page is in English");
  assert.equal(translate("greet", { name: "Ada & <Bo>" }, "farm"), "Hello Ada & <Bo>");
  assert.equal(translate("cows", { count: 1 }, "farm"), "1 cow");
  assert.equal(translate("cows", { count: 3 }, "farm"), "3 cows");
});

test("choosing a language fetches the site's words, tells listeners, and falls back key by key", async () => {
  const heard: string[] = [];
  const stop = onLanguageChange((l) => heard.push(l));
  await setLanguage("fr");
  stop();
  assert.deepEqual(heard, ["fr"]);
  assert.equal(getLanguage(), "fr");
  assert.equal(translate("greet", { name: "Ada" }, "farm"), "Bonjour Ada");
  assert.equal(translate("cows", { count: 3 }, "farm"), "3 vaches");
  assert.equal(translate("onlyEnglish", undefined, "farm"), "Barn");
  // The package's own words: French when its file exists, else English.
  const fr = LOCALE_LOADERS.fr ? (await LOCALE_LOADERS.fr()).default : en;
  assert.equal(translate("language.label"), fr["language.label"]);
  assert.equal(languageLocale(), "fr");
});

test("a namespace registered after the choice gets the chosen language straight away", async () => {
  const heard: string[] = [];
  const stop = onLanguageChange((l) => heard.push(l));
  await registerNamespace("late", { "word": "Late" }, { fr: async () => ({ "word": "Tard" }) });
  stop();
  assert.equal(translate("word", undefined, "late"), "Tard");
  assert.deepEqual(heard, ["fr"], "listeners hear that words arrived");
});

test("a language with no words, or whose words cannot be fetched, reads as English without error", async () => {
  await registerNamespace("flaky", { "word": "Steady" }, {
    ja: async () => {
      throw new Error("chunk gone");
    },
  });
  await setLanguage("ja");
  assert.equal(getLanguage(), "ja");
  assert.equal(translate("word", undefined, "flaky"), "Steady");
  assert.equal(translate("greet", { name: "Ada" }, "farm"), "Hello Ada");
});

test("the package's own words read as English in a language with no file yet", async (t) => {
  const bare = LANGUAGES.find((l) => l.code !== "en" && !LOCALE_LOADERS[l.code]);
  if (!bare) return t.skip("every language has its file");
  await setLanguage(bare.code);
  assert.equal(getLanguage(), bare.code);
  assert.equal(translate("language.label"), en["language.label"]);
});

test("an unknown language is English", async () => {
  await setLanguage("tlh");
  assert.equal(getLanguage(), "en");
  assert.equal(translate("greet", { name: "Ada" }, "farm"), "Hello Ada");
});

test("the latest of two quick choices wins", async () => {
  const first = setLanguage("fr");
  const second = setLanguage("es");
  await Promise.all([first, second]);
  assert.equal(getLanguage(), "es");
  await setLanguage("en");
});

test("the package's namespace cannot be overwritten by a site", () => {
  assert.throws(() => registerNamespace("tollbooth", {}), /own namespace/);
});

test("a guest with no stored choice starts in their country's language", async () => {
  await startLanguage(async () => "MX");
  assert.equal(getLanguage(), "es");
  await startLanguage(async () => "DE");
  assert.equal(getLanguage(), "en");
});

test("a choice made while the country is being asked for is kept", async () => {
  let answer: (country: string) => void = () => {};
  const started = startLanguage(() => new Promise((resolve) => { answer = resolve; }));
  await setLanguage("ja");
  answer("FR");
  await started;
  assert.equal(getLanguage(), "ja");
  await setLanguage("en");
});

test("structured content follows the language, piece by piece, as the same object", async () => {
  const lessons = [{ slug: "save", title: "Saving" }];
  const quotes = [{ text: "A penny saved." }];
  await registerNamespace("shelf", { lessons, quotes }, { fr: async () => ({ default: { lessons: [{ slug: "save", title: "Épargner" }] } }) });
  assert.deepEqual(content("shelf", "lessons"), lessons);
  await setLanguage("fr");
  assert.deepEqual(content("shelf", "lessons"), [{ slug: "save", title: "Épargner" }]);
  assert.equal(content("shelf", "lessons"), content("shelf", "lessons"), "the same language gives the same object");
  assert.deepEqual(content("shelf", "quotes"), quotes, "a piece French lacks is English's");
  assert.equal(content("shelf", "nothing"), undefined);
  await setLanguage("en");
});
