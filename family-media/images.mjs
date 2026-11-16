// Image intake: decode fully (rejects anything that is not a real JPEG/PNG/WebP), honour the EXIF
// orientation, then re-encode to fixed variants. The original upload is never stored and no
// metadata is carried over (sharp drops EXIF/GPS/XMP/ICC unless asked to keep it), so a variant
// can never carry location data or a polyglot payload.
import sharp from "sharp";

export const WIDTHS = [256, 640, 1280];
export const FORMATS = ["webp", "avif"];
export const MAX_BYTES = 4 * 1024 * 1024; // the editor downsizes in the browser first (Vercel body limit 4.5 MB)
const MAGIC = [
  { type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", test: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

/** @returns {{ type: string } | null} */
export function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  const m = MAGIC.find((x) => x.test(buf));
  return m ? { type: m.type } : null;
}

/**
 * @param {Buffer} buf
 * @returns {Promise<{ width: number, height: number, variants: Record<string, Buffer> }>}
 */
export async function processImage(buf) {
  if (buf.length > MAX_BYTES) throw Object.assign(new Error("too_large"), { status: 413 });
  if (!sniff(buf)) throw Object.assign(new Error("unsupported_type"), { status: 415 });
  const base = sharp(buf, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
  const meta = await base.clone().metadata(); // throws on a broken file
  if (!meta.width || !meta.height) throw Object.assign(new Error("unreadable"), { status: 422 });
  const variants = {};
  for (const w of WIDTHS) {
    const resized = base.clone().resize({ width: w, height: w, fit: "inside", withoutEnlargement: true });
    variants[`${w}.webp`] = await resized.clone().webp({ quality: 82 }).toBuffer();
    variants[`${w}.avif`] = await resized.clone().avif({ quality: 55 }).toBuffer();
  }
  const largest = await sharp(variants[`${WIDTHS.at(-1)}.webp`]).metadata();
  return { width: largest.width, height: largest.height, variants };
}
