import assert from "node:assert/strict";
import { test } from "node:test";
import { cafeProducts, parseCollections, parseProducts, plainText } from "./cafe.ts";

test("a store description reaches the page as plain words", () => {
  assert.equal(plainText("<p>Tea &amp; <b>coffee</b></p><script>x()</script>"), "Tea & coffee x()");
  assert.equal(plainText(null), "");
});

test("only the offered collections that hold something, in the site's order, with only the store's images", () => {
  const found = parseCollections({ collections: [
    { handle: "books", title: "Books", products_count: 3, image: { src: "https://evil.example/x.png" } },
    { handle: "empty", title: "Empty", products_count: 0 },
    { handle: "../up", title: "Up", products_count: 2 },
    { handle: "coffees", title: "Coffees", products_count: 9 },
    { handle: "mcps", title: "MCPs", products_count: 21 },
    { handle: "terroir", title: "Terroir", products_count: 6, image: { src: "https://cdn.shopify.com/t.png" }, description: "<p>Soil</p>" },
  ] }, ["terroir", "mcps", "books", "empty", "../up"]);
  assert.deepEqual(found.map((c) => c.handle), ["terroir", "mcps", "books"]);
  assert.equal(found[0].says, "Soil");
  assert.equal(found[0].image, "https://cdn.shopify.com/t.png");
  assert.equal(found[2].image, null);
  assert.equal(found[2].url, "https://cafe.tollbooth-dpyc.com/collections/books");
});

test("a malformed feed is an empty shelf", () => {
  assert.deepEqual(parseCollections(null, ["books"]), []);
  assert.deepEqual(parseProducts({ products: "no" }), []);
  assert.deepEqual(parseProducts({ products: [{ handle: "../x" }] }), []);
  assert.equal(parseProducts({ products: [{ handle: "mug", title: "Mug" }] })[0].url, "https://cafe.tollbooth-dpyc.com/products/mug");
});

test("a collection is read a page at a time, and a bad handle is never asked for", async () => {
  const asked: string[] = [];
  const fake = (async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify({ products: [{ handle: "mug", title: "Mug" }] }));
  }) as typeof fetch;
  assert.equal((await cafeProducts("books", 1, fake))[0].handle, "mug");
  assert.deepEqual(await cafeProducts("a/b", 0, fake), []);
  assert.deepEqual(asked, ["/cafe/collections/books/products.json?page=2"]);
});
