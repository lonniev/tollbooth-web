import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFacts } from "./buildInfo.ts";

describe("buildFacts", () => {
  it("reads the version, wheel and a linked commit", () => {
    const f = buildFacts({
      version: "0.40.2",
      tollbooth_dpyc_version: "0.90.0",
      build_info: {
        fastmcp_cloud_git_commit_sha: "654b0e4c50b26510afb95ff5e92993ae80fede75",
        fastmcp_cloud_git_repo: "https://github.com/lonniev/excalibur-mcp",
      },
    });
    assert.deepEqual(f, {
      version: "0.40.2",
      sdkVersion: "0.90.0",
      commit: "654b0e4",
      commitHref: "https://github.com/lonniev/excalibur-mcp/commit/654b0e4c50b26510afb95ff5e92993ae80fede75",
      repo: "github.com/lonniev/excalibur-mcp",
      repoHref: "https://github.com/lonniev/excalibur-mcp",
    });
  });

  it("links nothing that is not https", () => {
    const f = buildFacts({
      build_info: { fastmcp_cloud_git_commit_sha: "abcdef0", fastmcp_cloud_git_repo: "javascript:alert(1)" },
    });
    assert.equal(f.repoHref, null);
    assert.equal(f.commitHref, null);
    assert.equal(f.commit, "abcdef0");
  });

  it("ignores a commit that is not a hash", () => {
    assert.equal(buildFacts({ build_info: { fastmcp_cloud_git_commit_sha: "<b>x</b>" } }).commit, null);
  });

  it("is all null before the status arrives", () => {
    const f = buildFacts(null);
    assert.ok(Object.values(f).every((v) => v === null));
  });
});
