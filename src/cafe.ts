/**
 * The Good Brew café's public catalog, for a site's shelf of what the café
 * sells. Orders are placed at the café, never on the site.
 *
 * The store sends no CORS headers, so a site reads it through its own Pages
 * Function (`makeCafeProxy` in `./pagesProxy.ts`) at `/cafe/…`. Each site
 * names the collections it offers, in the order it offers them. Whatever the
 * feed holds, a page gets plain words, safe handles and only the store's own
 * images. First written for FieldData.
 */

export const CAFE_URL = "https://cafe.tollbooth-dpyc.com";
export const PRODUCT_PAGE_SIZE = 24;

export interface CafeCollection {
  handle: string;
  title: string;
  says: string;
  image: string | null;
  count: number;
  url: string;
}

export interface CafeProduct {
  handle: string;
  title: string;
  kind: string;
  image: string | null;
  url: string;
}

export const CAFE_HANDLE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** A store description as plain words. React escapes what is left, so no markup reaches the page. */
export function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();
}

/** Only the store's own image host is shown. */
function imageOf(src: unknown): string | null {
  return typeof src === "string" && src.startsWith("https://cdn.shopify.com/") ? src : null;
}

/** The offered collections that hold something, in the order `offered` lists them. */
export function parseCollections(feed: unknown, offered: ReadonlyArray<string>): CafeCollection[] {
  const rows = (feed as { collections?: Record<string, unknown>[] } | null)?.collections;
  if (!Array.isArray(rows)) return [];
  const found = rows.flatMap((c) => {
    const handle = String(c.handle ?? "");
    const count = Number(c.products_count ?? 0);
    if (!offered.includes(handle) || !CAFE_HANDLE.test(handle) || !(count > 0)) return [];
    return [{
      handle,
      title: String(c.title ?? handle),
      says: plainText(c.description ?? c.body_html),
      image: imageOf((c.image as { src?: unknown } | null)?.src),
      count,
      url: `${CAFE_URL}/collections/${handle}`,
    }];
  });
  return found.sort((a, b) => offered.indexOf(a.handle) - offered.indexOf(b.handle));
}

export function parseProducts(feed: unknown): CafeProduct[] {
  const rows = (feed as { products?: Record<string, unknown>[] } | null)?.products;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((p) => {
    const handle = String(p.handle ?? "");
    if (!CAFE_HANDLE.test(handle)) return [];
    const images = p.images as { src?: unknown }[] | undefined;
    return [{
      handle,
      title: String(p.title ?? handle),
      kind: String(p.product_type ?? ""),
      image: imageOf(Array.isArray(images) ? images[0]?.src : undefined),
      url: `${CAFE_URL}/products/${handle}`,
    }];
  });
}

async function readFeed(path: string, fetchImpl: typeof fetch): Promise<unknown> {
  const answer = await fetchImpl(path);
  if (!answer.ok) throw new Error("The café did not answer.");
  return answer.json();
}

/** The collections a site offers, read through its `/cafe` proxy. */
export const cafeCollections = async (offered: ReadonlyArray<string>, fetchImpl: typeof fetch = globalThis.fetch) =>
  parseCollections(await readFeed("/cafe/collections.json", fetchImpl), offered);

/** One collection's products; `page` is zero-based, like the package's page controls. */
export async function cafeProducts(handle: string, page: number, fetchImpl: typeof fetch = globalThis.fetch): Promise<CafeProduct[]> {
  if (!CAFE_HANDLE.test(handle)) return [];
  return parseProducts(await readFeed(`/cafe/collections/${handle}/products.json?page=${page + 1}`, fetchImpl));
}
