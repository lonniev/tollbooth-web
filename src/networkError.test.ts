import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorReport } from "./errorReport.ts";
import { isNetworkError, isTransportFailure, NetworkError } from "./networkError.ts";

// Stand-ins shaped like the MCP SDK's errors, without importing it.
function mcpError(code: number, message: string): Error {
  const e = new Error(`MCP error ${code}: ${message}`) as Error & { code: number };
  e.name = "McpError";
  e.code = code;
  return e;
}
function httpError(status: number, body: string): Error {
  const e = new Error(`Streamable HTTP error: Error POSTing to endpoint: ${body}`) as Error & { code: number };
  e.code = status;
  return e;
}
function named(name: string, message = name): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe("a call that never reached the service", () => {
  it("is each browser's fetch failure", () => {
    for (const m of [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
      "fetch failed",
      "The network connection was lost.",
    ]) {
      assert.equal(isTransportFailure(new TypeError(m), true), true, m);
    }
  });

  it("is an abort or a timeout before an answer", () => {
    assert.equal(isTransportFailure(named("AbortError"), true), true);
    assert.equal(isTransportFailure(named("TimeoutError"), true), true);
    assert.equal(isTransportFailure(mcpError(-32001, "Request timed out"), true), true);
    assert.equal(isTransportFailure(mcpError(-32000, "Connection closed"), true), true);
  });

  it("is the Pages proxy's own 502, when it could not reach the operator", () => {
    assert.equal(isTransportFailure(httpError(502, '{"error":"Proxy error","detail":"TypeError"}'), true), true);
  });

  it("is anything at all while the browser says it is offline", () => {
    assert.equal(isTransportFailure(new Error("whatever"), false), true);
  });
});

describe("an answer from the service is not a network failure", () => {
  it("covers tool errors, protocol errors and HTTP statuses the service sent", () => {
    assert.equal(isTransportFailure(new Error("Insufficient credit balance"), true), false);
    assert.equal(isTransportFailure(mcpError(-32602, "Invalid params"), true), false);
    assert.equal(isTransportFailure(httpError(500, "Internal Server Error"), true), false);
    assert.equal(isTransportFailure(httpError(502, "Bad gateway from the operator's host"), true), false);
    assert.equal(isTransportFailure(httpError(401, "unauthorized"), true), false);
  });

  it("does not mistake a programming TypeError for the network", () => {
    assert.equal(isTransportFailure(new TypeError("Cannot read properties of undefined (reading 'x')"), true), false);
    assert.equal(isTransportFailure("a string", true), false);
    assert.equal(isTransportFailure(undefined, true), false);
  });
});

describe("NetworkError", () => {
  it("names the tool, keeps the cause, and keeps the `<tool>: ` message prefix", () => {
    const cause = new TypeError("Failed to fetch");
    const e = new NetworkError("goodearth_task_save", cause);
    assert.equal(e.tool, "goodearth_task_save");
    assert.equal(e.cause, cause);
    assert.equal(e.name, "NetworkError");
    assert.equal(e.message, "goodearth_task_save: Failed to fetch");
    assert.ok(e instanceof Error);
    assert.equal(isNetworkError(e), true);
    assert.equal(isNetworkError(new Error("goodearth_task_save: Failed to fetch")), false);
  });
});

describe("the crash report", () => {
  it("carries the error, the component stack and the log", () => {
    const r = errorReport(new Error("boom"), "\n    at Page", "12:00  CALL  x()");
    assert.match(r, /^Error: boom/);
    assert.match(r, /Component stack:\n {4}at Page/);
    assert.match(r, /--- recent activity ---\n12:00 {2}CALL {2}x\(\)/);
    assert.equal(errorReport("odd"), "Error: odd");
  });
});
