import assert from "node:assert/strict";
import { test } from "node:test";
import { COUNTRY_LANGUAGES, countryFromTrace, languageForCountry } from "./geo.ts";
import { isLanguage } from "./languages.ts";

test("a country that speaks one of ours is shown in it, whatever the browser asks", () => {
  assert.equal(languageForCountry("FR", ["en-US"]), "fr");
  assert.equal(languageForCountry("MX", []), "es");
  assert.equal(languageForCountry("JP", ["en"]), "ja");
  assert.equal(languageForCountry("TW", null), "zh");
  assert.equal(languageForCountry("fr", undefined), "fr");
});

test("where a country speaks several of ours, the browser chooses among them", () => {
  assert.equal(languageForCountry("IN", ["hi-IN"]), "hi");
  assert.equal(languageForCountry("IN", ["en-GB"]), "en");
  assert.equal(languageForCountry("IN", ["de", "en-IN"]), "en");
  assert.equal(languageForCountry("CA", ["fr-CA"]), "fr");
  assert.equal(languageForCountry("US", ["es-MX", "en"]), "es");
});

test("a browser asking for none of a country's languages gets the country's main one", () => {
  assert.equal(languageForCountry("IN", ["de"]), "hi");
  assert.equal(languageForCountry("IN", ["ja"]), "hi");
  assert.equal(languageForCountry("CA", ["zh-CN"]), "en");
});

test("anywhere else, or nowhere known, is English", () => {
  assert.equal(languageForCountry("DE", ["fr"]), "en");
  assert.equal(languageForCountry(null, ["fr"]), "en");
  assert.equal(languageForCountry("", ["fr"]), "en");
  assert.equal(languageForCountry("ZZ", []), "en");
});

test("every language in the table is one the package speaks", () => {
  for (const [country, spoken] of Object.entries(COUNTRY_LANGUAGES)) {
    assert.match(country, /^[A-Z]{2}$/);
    assert.ok(spoken.length > 0 && spoken.every(isLanguage), country);
  }
});

test("the country is read from Cloudflare's trace, and nothing else counts", () => {
  assert.equal(countryFromTrace("fl=1\nh=chipin.example\nip=1.2.3.4\nloc=FR\ntls=TLSv1.3\n"), "FR");
  assert.equal(countryFromTrace("loc=XX\n"), null);
  assert.equal(countryFromTrace("loc=T1\n"), null);
  assert.equal(countryFromTrace("loc=france\n"), null);
  assert.equal(countryFromTrace("<html>loc=FR</html>"), null);
  assert.equal(countryFromTrace(""), null);
  assert.equal(countryFromTrace(undefined), null);
});
