import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { oncePerFrame, reclampPanel } from "./panelPlacement.ts";

describe("re-placing the filter panel while it is open", () => {
  it("slides it back in when the mark grows and pushes it past the right edge (Crops at 390 px)", () => {
    // Fitted on open (no slide), then ticking a toggle widens the mark by 30 px.
    const width = 280;
    const fitted = reclampPanel(0, 102, width, 390);
    assert.equal(fitted, 0);
    const dx = reclampPanel(fitted, 102 + 30, width, 390);
    assert.equal(dx, -30);
    assert.equal(102 + 30 + dx + width, 390 - 8, "right edge back on the margin");
  });

  it("drops the slide once the mark shrinks again, rather than keeping the old one", () => {
    // Drawn at 102 with a -30 slide in force: the CSS puts it at 132.
    // The mark shrinks back, so the CSS puts it at 102 and it fits unslid.
    const dx = reclampPanel(-30, 102 - 30, 280, 390);
    assert.equal(dx, 0);
  });

  it("keeps a panel already slid in from the left pinned to the margin as the mark grows", () => {
    // Right-aligned under a mark near the left: CSS puts it at -150, slid +158
    // to 8. The mark grows 20 px, so the CSS now puts it at -130; drawn at 28.
    const dx = reclampPanel(158, 28, 280, 390);
    assert.equal(dx, 138);
    assert.equal(-130 + dx, 8);
  });

  it("holds both margins after the window narrows", () => {
    const dx = reclampPanel(0, 100, 280, 360);
    assert.equal(100 + dx + 280, 360 - 8);
    assert.equal(reclampPanel(0, 100, 280, 360, 16) + 100 + 280, 360 - 16, "custom margin");
  });

  it("changes nothing when it still fits", () => {
    assert.equal(reclampPanel(-12, 50, 280, 390), 0, "a stale slide is dropped when the CSS place fits");
    assert.equal(reclampPanel(0, 20, 300, 390), 0);
  });
});

describe("oncePerFrame", () => {
  function fakeFrames() {
    const queue = new Map<number, () => void>();
    let next = 1;
    return {
      request: (cb: () => void) => {
        queue.set(next, cb);
        return next++;
      },
      release: (id: number) => void queue.delete(id),
      flush: () => {
        const due = [...queue.values()];
        queue.clear();
        for (const cb of due) cb();
      },
      get size() {
        return queue.size;
      },
    };
  }

  it("coalesces a burst of size changes into one placement per frame", () => {
    const f = fakeFrames();
    let runs = 0;
    const t = oncePerFrame(() => runs++, f.request, f.release);
    t.schedule();
    t.schedule();
    t.schedule();
    assert.equal(f.size, 1);
    f.flush();
    assert.equal(runs, 1);
    t.schedule();
    f.flush();
    assert.equal(runs, 2, "a later change gets its own frame");
  });

  it("drops a pending placement when the panel closes", () => {
    const f = fakeFrames();
    let runs = 0;
    const t = oncePerFrame(() => runs++, f.request, f.release);
    t.schedule();
    t.cancel();
    f.flush();
    assert.equal(runs, 0);
  });
});
