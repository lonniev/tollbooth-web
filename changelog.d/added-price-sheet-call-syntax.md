- Hover a tool's card on the `PriceSheet`, or focus it (a tap on a phone),
  to see how to call it: every parameter with its type, whether it is
  required, its default and what it is for. The sheet reads these from the
  MCP `tools/list`. If that read fails, the cards show as before. A new
  `schemas` prop takes the schemas when a site already has them, or `null`
  for none.
- `listTools()` returns every tool the operator lists with its input schema.
  `toolSignature()` and `signatureLines()` format a schema as call syntax
  without React.
