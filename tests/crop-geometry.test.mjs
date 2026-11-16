// Portrait crop geometry (R0 2026-11-16: "photo trimmed too much"). The editor's preview and the
// uploaded file both come from these numbers, so these tests pin what the admin sees = what is saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FRAME, OUTPUT, initial, place, rezoom, sourceRect, zoomRange } from "../app/lib/crop-geometry.mjs";

const SET = {
  "3:4 portrait": [1500, 2000],
  "4:3 group": [2000, 1500],
  "9:16 phone": [1080, 1920],
  "4:1 panorama": [4000, 1000],
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

test("frame and output are both 4:5, so the preview scales to the file exactly", () => {
  near(FRAME.w / FRAME.h, 0.8);
  near(OUTPUT.w / OUTPUT.h, 0.8);
  near(OUTPUT.w / FRAME.w, OUTPUT.h / FRAME.h);
});

for (const [name, [iw, ih]] of Object.entries(SET)) {
  test(`${name}: default is the largest 4:5 region, anchored at the top`, () => {
    const p = place({ iw, ih, ...initial(iw, ih) });
    const r = sourceRect(p, iw, ih);
    near(r.sw / r.sh, 0.8, 1e-3);
    assert.ok(Math.abs(r.sw - iw) < 1e-6 || Math.abs(r.sh - ih) < 1e-6, "largest region touches two sides of the photo");
    near(r.sy, 0); // top kept (faces)
    if (r.sw < iw) near(r.sx, (iw - r.sw) / 2, 1e-6); // centred across
  });

  test(`${name}: zooming out to the minimum shows the whole photo, centred`, () => {
    const s = rezoom({ iw, ih, ...initial(iw, ih) }, zoomRange(iw, ih).min);
    const p = place({ iw, ih, ...s });
    const r = sourceRect(p, iw, ih);
    near(r.sx, 0); near(r.sy, 0); near(r.sw, iw, 1e-6); near(r.sh, ih, 1e-6);
    assert.ok(p.w <= FRAME.w + 1e-9 && p.h <= FRAME.h + 1e-9);
    near(p.x, (FRAME.w - p.w) / 2, 1e-6); near(p.y, (FRAME.h - p.h) / 2, 1e-6);
  });

  test(`${name}: panning never leaves an empty edge at cover zoom, never pushes the photo out when zoomed out`, () => {
    for (const z of [1, 2, zoomRange(iw, ih).min]) {
      for (const [x, y] of [[-1e6, -1e6], [1e6, 1e6], [0, 0]]) {
        const p = place({ iw, ih, zoom: z, x, y });
        if (p.w >= FRAME.w) assert.ok(p.x <= 0 && p.x + p.w >= FRAME.w - 1e-9); else assert.ok(p.x >= 0 && p.x + p.w <= FRAME.w + 1e-9);
        if (p.h >= FRAME.h) assert.ok(p.y <= 0 && p.y + p.h >= FRAME.h - 1e-9); else assert.ok(p.y >= 0 && p.y + p.h <= FRAME.h + 1e-9);
      }
    }
  });
}

test("zoom keeps the point under the frame centre in place", () => {
  const [iw, ih] = SET["4:3 group"];
  const s0 = { iw, ih, zoom: 1.5, x: -100, y: -60 };
  const p0 = place(s0);
  const cx = (FRAME.w / 2 - p0.x) / p0.w;
  const s1 = rezoom(s0, 2);
  const p1 = place({ iw, ih, ...s1 });
  near((FRAME.w / 2 - p1.x) / p1.w, cx, 1e-9);
});
