import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KARTEL — Coat of Arms, Legacy, London";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#eeebe5",
          fontFamily: "Georgia, Times New Roman, serif",
        }}
      >
        {/* Top decorative line */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 2,
            backgroundColor: "#c4b89a",
            marginBottom: 40,
          }}
        />

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            letterSpacing: "0.15em",
            color: "#9b723a",
            marginBottom: 16,
          }}
        >
          KARTEL
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#6f685c",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          Coat of Arms &bull; Family Legacy &bull; London
        </div>

        {/* Motto */}
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontStyle: "italic",
            color: "#9b723a",
            marginTop: 24,
          }}
        >
          Virtus et Potestas
        </div>

        {/* Bottom decorative line */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 2,
            backgroundColor: "#c4b89a",
            marginTop: 40,
          }}
        />

        {/* Domain */}
        <div
          style={{
            display: "flex",
            fontSize: 14,
            color: "#9a9488",
            letterSpacing: "0.1em",
            marginTop: 24,
          }}
        >
          kartel.org.uk
        </div>
      </div>
    ),
    { ...size }
  );
}
