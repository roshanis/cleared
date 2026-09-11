import { ImageResponse } from "next/og";

/* Home-screen tile for iOS. iOS masks and rounds the corners itself, so this
   paints edge to edge — a rounded square here would be rounded twice. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#083f45",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path
            d="M21.1 9.9A8 8 0 1 0 21.1 22.1"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <circle cx="24.6" cy="16" r="2.4" fill="#4fbfc7" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
