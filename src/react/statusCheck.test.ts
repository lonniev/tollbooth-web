import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NetworkError } from "../networkError.ts";
import { STATUS_CONNECTING, STATUS_ERROR_MAX, statusErrorMessage, statusReducer } from "./statusCheck.ts";

const ANSWER = { success: true, service: "taxsort", version: "1.0.0" };

describe("the shell's service check", () => {
  it("starts connecting, with no answer and no error", () => {
    assert.deepEqual(STATUS_CONNECTING, { state: "connecting", status: null, error: null });
  });

  it("is ready once service_status answers", () => {
    const s = statusReducer(STATUS_CONNECTING, { type: "ok", status: ANSWER });
    assert.equal(s.state, "ready");
    assert.deepEqual(s.status, ANSWER);
    assert.equal(s.error, null);
  });

  it("is failed — not still connecting — when the check throws", () => {
    const s = statusReducer(STATUS_CONNECTING, { type: "fail", error: new Error("Streamable HTTP error: 503") });
    assert.equal(s.state, "failed");
    assert.equal(s.error, "Streamable HTTP error: 503");
  });

  it("goes back to connecting on a retry, clearing the error and keeping the last answer", () => {
    const ready = statusReducer(STATUS_CONNECTING, { type: "ok", status: ANSWER });
    const failed = statusReducer(ready, { type: "fail", error: new Error("boom") });
    assert.deepEqual(failed.status, ANSWER, "a failed retry does not throw away what the service said");
    const retrying = statusReducer(failed, { type: "start" });
    assert.deepEqual(retrying, { state: "connecting", status: ANSWER, error: null });
    assert.equal(statusReducer(retrying, { type: "ok", status: ANSWER }).state, "ready");
  });
});

describe("the failure a banner shows", () => {
  it("says the service could not be reached when the call never arrived", () => {
    const e = new NetworkError("taxsort_service_status", new TypeError("Failed to fetch"));
    assert.equal(statusErrorMessage(e), "Could not reach the service — Failed to fetch");
  });

  it("drops the runtime tool name and collapses whitespace", () => {
    const e = new Error("taxsort_service_status: Streamable HTTP error:\n  Error POSTing   to endpoint");
    assert.equal(statusErrorMessage(e), "Streamable HTTP error: Error POSTing to endpoint");
  });

  it("scrubs secrets with the debug log's scrubber", () => {
    const key = "a".repeat(64);
    const msg = statusErrorMessage(new Error(`bad dpop_token=abc123 key ${key}`));
    assert.ok(!msg.includes("abc123"));
    assert.ok(!msg.includes(key));
    assert.match(msg, /\[redacted\]/);
  });

  it("is short", () => {
    const msg = statusErrorMessage(new Error("x".repeat(500)));
    assert.equal(msg.length, STATUS_ERROR_MAX);
    assert.ok(msg.endsWith("…"));
  });

  it("still says something when the thrown value is empty", () => {
    assert.equal(statusErrorMessage(new Error("")), "The service did not answer");
    assert.equal(statusErrorMessage(undefined), "The service did not answer");
  });
});
