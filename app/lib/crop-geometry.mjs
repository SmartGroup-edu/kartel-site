/**
 * Portrait crop geometry for the family editor (4:5 frame). Pure, so the preview and the uploaded
 * file come from the same numbers and can be unit-tested.
 *
 * Coordinates: the image is placed in a frame of fw × fh (preview pixels) at top-left (x, y) with
 * size (w, h). zoom = 1 is "cover" (the largest 4:5 region of the photo fills the frame); the
 * smallest zoom is "fit" (the whole photo is visible, the rest of the frame is a plain background).
 */

export const FRAME = { w: 360, h: 450 }; // 4:5 preview (drawn smaller on short screens)
export const OUTPUT = { w: 1024, h: 1280 }; // 4:5 file sent to the service (same ratio as FRAME)
export const MAX_ZOOM = 3;

/** @param {number} iw @param {number} ih @param {number} fw @param {number} fh */
export function zoomRange(iw, ih, fw = FRAME.w, fh = FRAME.h) {
  const cover = Math.max(fw / iw, fh / ih);
  const fit = Math.min(fw / iw, fh / ih);
  return { min: fit / cover, max: MAX_ZOOM };
}

/** Keep the photo covering the frame on an axis where it is larger, and inside it where smaller. */
function clampAxis(pos, size, frame) {
  return size >= frame ? Math.min(0, Math.max(frame - size, pos)) : Math.max(0, Math.min(frame - size, pos));
}

/**
 * @param {{ iw: number, ih: number, zoom: number, x: number, y: number, fw?: number, fh?: number }} s
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function place({ iw, ih, zoom, x, y, fw = FRAME.w, fh = FRAME.h }) {
  const { min, max } = zoomRange(iw, ih, fw, fh);
  const z = Math.min(max, Math.max(min, zoom));
  const s = Math.max(fw / iw, fh / ih) * z;
  const w = iw * s, h = ih * s;
  return { x: clampAxis(x, w, fw), y: clampAxis(y, h, fh), w, h };
}

/** Default: the largest 4:5 region, centred across, at the top (faces are usually near the top). */
export function initial(iw, ih, fw = FRAME.w, fh = FRAME.h) {
  const w = iw * Math.max(fw / iw, fh / ih); // at zoom 1 the photo covers the frame, so y = 0 is the top
  return { zoom: 1, x: (fw - w) / 2, y: 0 };
}

/** Change zoom keeping the point under the frame centre where it is. */
export function rezoom({ iw, ih, zoom, x, y, fw = FRAME.w, fh = FRAME.h }, next) {
  const cur = place({ iw, ih, zoom, x, y, fw, fh });
  const { min, max } = zoomRange(iw, ih, fw, fh);
  const z = Math.min(max, Math.max(min, next));
  const s = Math.max(fw / iw, fh / ih) * z;
  const cx = (fw / 2 - cur.x) / cur.w, cy = (fh / 2 - cur.y) / cur.h; // centre, as a fraction of the photo
  const p = place({ iw, ih, zoom: z, x: fw / 2 - cx * iw * s, y: fh / 2 - cy * ih * s, fw, fh });
  return { zoom: z, x: p.x, y: p.y };
}

/** The region of the source photo (in source pixels) that ends up inside the frame. */
export function sourceRect(p, iw, ih, fw = FRAME.w, fh = FRAME.h) {
  const s = p.w / iw;
  const sx = Math.max(0, -p.x / s), sy = Math.max(0, -p.y / s);
  return { sx, sy, sw: Math.min(iw - sx, fw / s), sh: Math.min(ih - sy, fh / s) };
}
