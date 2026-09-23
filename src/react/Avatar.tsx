import { isAvatarUrl } from "../avatar.ts";

/** An emoji glyph or an image, in a circle. */
export default function Avatar({
  value,
  size = 40,
  className = "",
}: {
  value?: string | null;
  size?: number;
  className?: string;
}) {
  const raw = value && value.trim() ? value : "🃏";
  return (
    <span
      style={{ width: size, height: size, minWidth: size, fontSize: Math.round(size * 0.55), lineHeight: 1 }}
      className={`inline-flex items-center justify-center overflow-hidden rounded-full select-none border border-[var(--tb-line)] bg-[var(--tb-surface-2)] ${className}`}
    >
      {isAvatarUrl(raw) ? (
        <img src={raw} alt="" loading="lazy" className="block h-full w-full object-cover" />
      ) : (
        raw
      )}
    </span>
  );
}
