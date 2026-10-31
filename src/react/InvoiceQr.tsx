/**
 * A Lightning invoice as a code to scan, and the line that tells someone with no
 * bitcoin they can still pay. Always dark on white with its quiet zone, whatever
 * the site's theme, because a camera needs that to read it.
 */

import { useMemo } from "react";
import { invoiceQrText, qrModules, qrPath } from "../qr.ts";

const QUIET = 4;

/** For a page that draws its own invoice. */
export const PAY_FROM_CASH_LINE = "No bitcoin? Strike and Cash App can pay this from the cash balance you hold there.";

export default function InvoiceQr({ bolt11, size = 220, className }: { bolt11?: string | null; size?: number; className?: string }) {
  const drawn = useMemo(() => {
    const text = invoiceQrText(bolt11);
    if (!text) return null;
    const modules = qrModules(text);
    return { path: qrPath(modules, QUIET), box: modules.length + QUIET * 2 };
  }, [bolt11]);
  if (!drawn) return null;
  return (
    <svg
      role="img"
      aria-label="QR code of this Lightning invoice"
      viewBox={`0 0 ${drawn.box} ${drawn.box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", maxWidth: "100%", height: "auto", background: "#fff", borderRadius: 8 }}
    >
      <path d={drawn.path} fill="#000" />
    </svg>
  );
}
