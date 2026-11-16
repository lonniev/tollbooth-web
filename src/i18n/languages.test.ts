import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LANGUAGES,
  languageForBrowser,
  languageFrom,
  localeFor,
} from "./languages.ts";

test("six languages, each under its own name, English first", () => {
  assert.deepEqual(
    LANGUAGES.map((l) => [l.code, l.name]),
    [["en", "English"], ["fr", "Français"], ["es", "Español"], ["ja", "日本語"], ["zh", "中文"], ["hi", "हिन्दी"]],
  );
  assert.equal(DEFAULT_LANGUAGE, "en");
  assert.equal(LANGUAGE_STORAGE_KEY, "tollbooth:language");
});

test("a stored choice is read only when it is one of the six", () => {
  assert.equal(languageFrom("ja"), "ja");
  for (const junk of ["", "de", "EN", "fr-CA", null, undefined]) assert.equal(languageFrom(junk), null, String(junk));
});

test("the browser's languages map to the first one the package speaks", () => {
  assert.equal(languageForBrowser(["fr-CA"]), "fr");
  assert.equal(languageForBrowser(["zh-TW"]), "zh");
  assert.equal(languageForBrowser(["zh-Hant-HK", "en"]), "zh");
  assert.equal(languageForBrowser(["es_MX"]), "es");
  assert.equal(languageForBrowser(["HI-in"]), "hi");
  assert.equal(languageForBrowser(["de-DE", "ja-JP", "en-US"]), "ja");
  assert.equal(languageForBrowser(["de", "pt-BR"]), "en");
  assert.equal(languageForBrowser([]), "en");
  assert.equal(languageForBrowser(undefined), "en");
});

test("dates take the browser's regional form of the chosen language", () => {
  assert.equal(localeFor("en", ["en-GB", "fr"]), "en-GB");
  assert.equal(localeFor("fr", ["en-GB", "fr-CA"]), "fr-CA");
  assert.equal(localeFor("ja", ["en-US"]), "ja");
  assert.equal(localeFor("hi", undefined), "hi");
});
