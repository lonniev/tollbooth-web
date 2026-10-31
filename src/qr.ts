/**
 * The picture of a Lightning invoice, for someone paying from another device.
 *
 * Uppercase on purpose: a BOLT11 string is case-insensitive, and QR's alphanumeric
 * mode holds uppercase text in a far smaller, easier-to-scan code.
 */

import qrcode from "qrcode-generator";

const BOLT11 = /^ln(bc|tb|bs|tbs)[0-9a-z]+$/i;

/** What a wallet's camera should read for this invoice, or null if it is no invoice. */
export function invoiceQrText(bolt11: string | null | undefined): string | null {
  return bolt11 && BOLT11.test(bolt11) ? `LIGHTNING:${bolt11.toUpperCase()}` : null;
}

/** The code's squares, row by row: true is dark. */
export function qrModules(text: string): boolean[][] {
  const code = qrcode(0, "L");
  code.addData(text, "Alphanumeric");
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => code.isDark(row, col)),
  );
}

/** The dark squares as one SVG path, with the same units as the squares. */
export function qrPath(modules: boolean[][], quiet: number): string {
  return modules
    .flatMap((cells, y) => cells.flatMap((dark, x) => (dark ? [`M${x + quiet} ${y + quiet}h1v1h-1z`] : [])))
    .join("");
}
