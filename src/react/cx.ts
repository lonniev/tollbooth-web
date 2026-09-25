/** Join the class names that are set; undefined when none are, so no empty `class=""`. */
export function cx(...parts: (string | false | null | undefined)[]): string | undefined {
  const s = parts.filter(Boolean).join(" ");
  return s || undefined;
}
