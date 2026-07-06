import { ImageResponse } from "next/og";

export const alt = "Cleared — compliance review, before it ships";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const verdictChips = [
  { label: "Pass", color: "#7fd4a1", bg: "rgba(21, 128, 61, 0.35)" },
  { label: "Needs review", color: "#f0c48a", bg: "rgba(154, 74, 11, 0.35)" },
  { label: "Fail", color: "#f0a3a3", bg: "rgba(185, 28, 28, 0.35)" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#083f45",
          padding: "72px 80px",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
          <span>Cleared</span>
          <span style={{ color: "#8fc7c4" }}>.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            <span>Compliance review,</span>
            <span style={{ color: "rgba(255, 255, 255, 0.72)" }}>
              before it ships.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 30,
              lineHeight: 1.4,
              color: "rgba(255, 255, 255, 0.72)",
              maxWidth: 940,
            }}
          >
            Fast feedback for writers. Full authority for compliance. A
            complete trail for auditors.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {verdictChips.map((chip) => (
            <div
              key={chip.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderRadius: 999,
                padding: "10px 24px",
                fontSize: 24,
                fontWeight: 600,
                color: chip.color,
                backgroundColor: chip.bg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: chip.color,
                }}
              />
              {chip.label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
