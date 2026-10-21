/**
 * A tool's call syntax, read from the input schema `tools/list` returns.
 *
 * Pure: `toolSignature` turns a JSON Schema into the parameters an MCP client
 * passes — name, type, whether it is required, its default and what it is
 * for — required ones first, each group in the schema's own order.
 */

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  description?: string;
  [key: string]: unknown;
}

/** One tool as `tools/list` describes it. */
export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

export interface SignatureParam {
  name: string;
  /** TypeScript-flavoured: `string`, `integer`, `string[]`, `object | null`, `"day" | "week"`. */
  type: string;
  required: boolean;
  /** The default as JSON, when the schema gives one. */
  default?: string;
  description?: string;
}

export function schemaType(s: JsonSchema | undefined): string {
  if (!s || typeof s !== "object") return "any";
  if ("const" in s) return JSON.stringify(s.const);
  if (Array.isArray(s.enum) && s.enum.length) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  const alts = s.anyOf ?? s.oneOf;
  if (Array.isArray(alts) && alts.length) {
    const parts = alts.map(schemaType);
    // `null` last, as a reader expects "string[] | null".
    return [...new Set(parts)].sort((a, b) => Number(a === "null") - Number(b === "null")).join(" | ");
  }
  if (Array.isArray(s.type)) return s.type.map((t) => schemaType({ ...s, type: t })).join(" | ");
  if (s.type === "array") {
    const inner = schemaType(s.items);
    return inner.includes(" | ") ? `(${inner})[]` : `${inner}[]`;
  }
  return typeof s.type === "string" ? s.type : "any";
}

export function toolSignature(schema: JsonSchema | undefined): SignatureParam[] {
  const props = schema?.properties;
  if (!props || typeof props !== "object") return [];
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const params = Object.entries(props).map(([name, p]): SignatureParam => {
    const param: SignatureParam = { name, type: schemaType(p), required: required.has(name) };
    if (p && "default" in p) param.default = JSON.stringify(p.default);
    if (typeof p?.description === "string" && p.description.trim()) param.description = p.description.trim();
    return param;
  });
  return [...params.filter((p) => p.required), ...params.filter((p) => !p.required)];
}

/** One line per parameter, as the popup's code block shows it. */
export function signatureLines(name: string, params: SignatureParam[]): string[] {
  if (params.length === 0) return [`${name}()`];
  return [
    `${name}(`,
    ...params.map(
      (p, i) =>
        `  ${p.name}${p.required ? "" : "?"}: ${p.type}${p.default !== undefined ? ` = ${p.default}` : ""}${i < params.length - 1 ? "," : ""}`,
    ),
    ")",
  ];
}
