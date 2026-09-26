/**
 * The pure half of `SiteNav`: which item is the current page, and where focus
 * goes when a key is pressed inside an open menu. No DOM, no router.
 */

/** The path part of an href: no query, no hash, no trailing slash (but "/" stays "/"). */
export function pathOf(href: string): string {
  const cut = href.split(/[?#]/, 1)[0] || "/";
  return cut.length > 1 ? cut.replace(/\/+$/, "") || "/" : cut;
}

/**
 * True when `href` is the page at `pathname`.
 *
 * `end` asks for the exact path; without it an href also owns everything
 * beneath it, on a segment boundary — "/posts" is active on "/posts/42" but
 * never on "/postscript". "/" without `end` is active everywhere, as a
 * router's NavLink is; give the home item `end`.
 */
export function matchesPath(pathname: string, href: string, end = false): boolean {
  const here = pathOf(pathname);
  const target = pathOf(href);
  if (here === target) return true;
  if (end) return false;
  if (target === "/") return true;
  return here.startsWith(`${target}/`);
}

/**
 * The index to focus after `key` in an open menu of `count` items, with focus
 * now on `current` (-1 when it is on none of them). `null` when the key is not
 * one the menu moves on. Arrows wrap; Home and End go to the ends.
 */
export function menuFocusIndex(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
