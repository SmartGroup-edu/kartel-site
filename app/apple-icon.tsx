import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS / iPadOS home-screen and address-bar icon. Square, no transparency,
// no pre-rounded corners — iOS rounds them itself and would crop a
// pre-rounded asset.
export default function AppleIcon() {
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
          fontSize: 130,
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
