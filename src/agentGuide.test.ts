import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { agentGuide, injectFrontDoor, renderAgentGuide, type AgentGuideOptions } from "./agentGuide.ts";

const OPTS: AgentGuideOptions = {
  name: "Good Earth",
  summary: "Climate timing for cottage gardens.",
  site: "https://goodearth.tollbooth-dpyc.com/",
  mcpUrl: "https://goodearth-mcp.fastmcp.app/mcp",
  toolPrefix: "goodearth",
  source: "https://github.com/lonniev/goodearth-mcp",
  registryName: "io.github.lonniev/goodearth-mcp",
  body: "agent-guide.md",
};
const BODY = "## What it answers\n\nFrost dates for your own ground.\n";

test("the guide is the service's sections, then each shared section once", () => {
  const g = renderAgentGuide(OPTS, BODY);
  assert.ok(g.startsWith("# Good Earth\n\n> Climate timing for cottage gardens.\n\n## What it answers"));
  for (const h of ["## Connecting an agent", "## Payments and identity", "## License, patent, and trademarks", "## Links"]) {
    assert.equal(g.split(h).length, 2, h);
  }
  assert.ok(g.indexOf("## What it answers") < g.indexOf("## Connecting an agent"));
});

test("the tool names carry the service's prefix", () => {
  const g = renderAgentGuide(OPTS, BODY);
  for (const t of ["goodearth_request_npub_proof", "goodearth_receive_npub_proof", "goodearth_check_balance", "goodearth_purchase_credits", "goodearth_check_payment"]) {
    assert.ok(g.includes(`\`${t}(`) || g.includes(`\`${t}\``), t);
  }
  assert.ok(!/`request_npub_proof/.test(g));
  assert.ok(g.includes("claude mcp add --transport http goodearth https://goodearth-mcp.fastmcp.app/mcp"));
  assert.ok(g.includes("io.github.lonniev/goodearth-mcp"));
  assert.ok(g.includes("- Web app: https://goodearth.tollbooth-dpyc.com\n"));
});

test("an agent is told never to ask for an nsec", () => {
  assert.match(renderAgentGuide(OPTS, BODY), /Never ask for an nsec/);
});

test("a body that still carries a shared section is refused", () => {
  assert.throws(() => renderAgentGuide(OPTS, BODY + "\n## Links\n\n- x\n"), /still carries "## Links"/);
});

test("a body with its own title is refused", () => {
  assert.throws(() => renderAgentGuide(OPTS, "# Good Earth\n\nhello"), /own "# " title/);
});

test("options are checked, not trusted", () => {
  assert.throws(() => renderAgentGuide({ ...OPTS, mcpUrl: "http://x.test/mcp" }, BODY), /must be https/);
  assert.throws(() => renderAgentGuide({ ...OPTS, site: "javascript:alert(1)" }, BODY), /must be https/);
  assert.throws(() => renderAgentGuide({ ...OPTS, toolPrefix: "Good Earth" }, BODY), /lowercase identifier/);
  assert.throws(() => renderAgentGuide({ ...OPTS, summary: " " }, BODY), /summary is required/);
  assert.throws(() => renderAgentGuide(OPTS, "  \n"), /is empty/);
});

const SHELL = `<!doctype html>
<html>
  <head>
    <title>x</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

test("an empty root gets words a fetcher can read, and the head links the guide", () => {
  const html = injectFrontDoor(SHELL, OPTS);
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/llms.txt"/);
  assert.match(html, /<div id="root">\s*<main id="agent-intro"/);
  assert.match(html, /<h1>Good Earth<\/h1>/);
  assert.match(html, /href="https:\/\/goodearth-mcp.fastmcp.app\/mcp"/);
});

test("a root that already holds markup, and a head that already links the guide, are left alone", () => {
  const own = SHELL.replace('<div id="root"></div>', '<div id="root"><main>Ours</main></div>').replace(
    "</head>",
    '<link rel="alternate" type="text/plain" href="/llms.txt" /></head>',
  );
  assert.equal(injectFrontDoor(own, OPTS), own);
});

test("the name and summary are escaped into the page", () => {
  const html = injectFrontDoor(SHELL, { ...OPTS, name: "<b>X</b>", summary: 'a "b" & c' });
  assert.match(html, /<h1>&lt;b&gt;X&lt;\/b&gt;<\/h1>/);
  assert.match(html, /a &quot;b&quot; &amp; c/);
});

test("the plugin emits llms.txt from the body file under the Vite root", () => {
  const root = mkdtempSync(join(tmpdir(), "agent-guide-"));
  writeFileSync(join(root, "agent-guide.md"), BODY);
  const plugin = agentGuide(OPTS);
  plugin.configResolved({ root });
  plugin.buildStart();
  let emitted: { fileName: string; source: string } | undefined;
  plugin.generateBundle.call({ emitFile: (f) => (emitted = f) });
  assert.equal(emitted?.fileName, "llms.txt");
  assert.equal(emitted?.source, renderAgentGuide(OPTS, BODY));
});
