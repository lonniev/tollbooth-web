import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesPath, menuFocusIndex, pathOf } from "./navState.ts";

describe("which nav item is the current page", () => {
  it("matches the exact path", () => {
    assert.equal(matchesPath("/wallet", "/wallet"), true);
    assert.equal(matchesPath("/wallet/", "/wallet"), true, "a trailing slash is the same page");
  });

  it("owns the pages beneath it unless `end` is set", () => {
    assert.equal(matchesPath("/notebook/issues/42", "/notebook/issues"), true);
    assert.equal(matchesPath("/notebook/issues", "/notebook", true), false);
    assert.equal(matchesPath("/notebook", "/notebook", true), true);
  });

  it("never matches a longer word that merely starts the same", () => {
    assert.equal(matchesPath("/postscript", "/posts"), false);
    assert.equal(matchesPath("/snippets-old", "/snippets"), false);
  });

  it("treats home as active everywhere without `end`, and only at / with it", () => {
    assert.equal(matchesPath("/designs", "/"), true);
    assert.equal(matchesPath("/designs", "/", true), false);
    assert.equal(matchesPath("/", "/", true), true);
  });

  it("ignores the href's query and hash", () => {
    assert.equal(matchesPath("/posts", "/posts?tab=draft#top", true), true);
    assert.equal(pathOf("?x=1"), "/");
    assert.equal(pathOf("/a//"), "/a");
  });
});

describe("moving focus in an open menu", () => {
  it("steps down and up, wrapping at the ends", () => {
    assert.equal(menuFocusIndex("ArrowDown", 0, 3), 1);
    assert.equal(menuFocusIndex("ArrowDown", 2, 3), 0);
    assert.equal(menuFocusIndex("ArrowUp", 0, 3), 2);
  });

  it("enters from outside the items at the near end", () => {
    assert.equal(menuFocusIndex("ArrowDown", -1, 3), 0);
    assert.equal(menuFocusIndex("ArrowUp", -1, 3), 2);
  });

  it("jumps with Home and End, and ignores other keys and empty menus", () => {
    assert.equal(menuFocusIndex("Home", 2, 3), 0);
    assert.equal(menuFocusIndex("End", 0, 3), 2);
    assert.equal(menuFocusIndex("Enter", 0, 3), null);
    assert.equal(menuFocusIndex("ArrowDown", -1, 0), null);
  });
});
