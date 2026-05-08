import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Browser tab / address-bar favicon. The full coat of arms doesn't survive
// scaling to 16-32px (it averages to a dark blob), so we render a clean
// K mark instead — same dark-on-gold palette as the brand.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2b2824",
          color: "#876035",
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "serif",
          letterSpacing: "0.02em",
        }}
      >
        K
      </div>
    ),
    size
  );
}
