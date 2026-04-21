import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const alt = "KARTEL — Coat of Arms of the Kartel Family. Virtus et Potestas.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  let crestSrc: string | null = null;

  try {
    const buf = await readFile(join(process.cwd(), "public", "crest.jpeg"));
    const base64 = buf.toString("base64");
    crestSrc = `data:image/jpeg;base64,${base64}`;
  } catch {
    // Fallback to text-only if file read fails
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#eeebe5",
          fontFamily: "Georgia, Times New Roman, serif",
          padding: "48px 60px",
          gap: "48px",
        }}
      >
        {/* Left: Crest image */}
        {crestSrc && (
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              width: 340,
              height: 340,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={crestSrc}
              alt=""
              width={340}
              height={340}
              style={{ objectFit: "contain" }}
            />
          </div>
        )}

        {/* Right: Text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: crestSrc ? "flex-start" : "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          {/* Top decorative line */}
          <div
            style={{
              display: "flex",
              width: 80,
              height: 2,
              backgroundColor: "#c4b89a",
              marginBottom: 28,
            }}
          />

          {/* Title */}
          <div
            style={{
              display: "flex",
              fontSize: 64,
              letterSpacing: "0.15em",
              color: "#9b723a",
              marginBottom: 12,
            }}
          >
            KARTEL
          </div>

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#6f685c",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Coat of Arms · Family Legacy · London
          </div>

          {/* Motto */}
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontStyle: "italic",
              color: "#9b723a",
              marginTop: 20,
            }}
          >
            Virtus et Potestas
          </div>

          {/* Bottom decorative line */}
          <div
            style={{
              display: "flex",
              width: 80,
              height: 2,
              backgroundColor: "#c4b89a",
              marginTop: 28,
            }}
          />

          {/* Domain */}
          <div
            style={{
              display: "flex",
              fontSize: 14,
              color: "#9a9488",
              letterSpacing: "0.1em",
              marginTop: 16,
            }}
          >
            kartel.org.uk
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
