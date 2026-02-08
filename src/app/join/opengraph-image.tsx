import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ShermBowl — Super Bowl LX Prop Bets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Team colors
const PATS = { primary: "#C60C30", secondary: "#002244", silver: "#B0B7BC" };
const HAWKS = { primary: "#69BE28", secondary: "#002244", blue: "#0076B6" };

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top accent bar — Pats red to Hawks green */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: `linear-gradient(90deg, ${PATS.primary}, ${HAWKS.primary})`,
          }}
        />

        {/* Subtle background glow */}
        <div
          style={{
            position: "absolute",
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "800px",
            height: "350px",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, transparent 70%)",
          }}
        />

        {/* Super Bowl LX label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "2px",
              background: "linear-gradient(90deg, transparent, #52525b)",
            }}
          />
          <span
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#71717a",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
            }}
          >
            Super Bowl LX
          </span>
          <div
            style={{
              width: "40px",
              height: "2px",
              background: "linear-gradient(90deg, #52525b, transparent)",
            }}
          />
        </div>

        {/* Title — dominant */}
        <div style={{ display: "flex", alignItems: "baseline" }}>
          <span
            style={{
              fontSize: "156px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            SHERM
          </span>
          <span
            style={{
              fontSize: "156px",
              fontWeight: 900,
              color: "#22c55e",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            BOWL
          </span>
        </div>

        {/* Matchup with logos */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "40px",
            marginTop: "16px",
          }}
        >
          {/* Patriots */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://a.espncdn.com/i/teamlogos/nfl/500/ne.png"
              width="64"
              height="64"
              style={{ objectFit: "contain" }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "56px",
                  fontWeight: 900,
                  color: PATS.primary,
                  lineHeight: 1,
                }}
              >
                NE
              </span>
              <span
                style={{
                  fontSize: "15px",
                  color: PATS.silver,
                  marginTop: "2px",
                  fontWeight: 600,
                }}
              >
                Patriots
              </span>
            </div>
          </div>

          <span
            style={{
              fontSize: "18px",
              color: "#52525b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            vs
          </span>

          {/* Seahawks */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "56px",
                  fontWeight: 900,
                  color: HAWKS.primary,
                  lineHeight: 1,
                }}
              >
                SEA
              </span>
              <span
                style={{
                  fontSize: "15px",
                  color: "#A5ACAF",
                  marginTop: "2px",
                  fontWeight: 600,
                }}
              >
                Seahawks
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://a.espncdn.com/i/teamlogos/nfl/500/sea.png"
              width="64"
              height="64"
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Info line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginTop: "28px",
            fontSize: "21px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#d4a853" }}>$50 In</span>
          <span style={{ color: "#3f3f46" }}>/</span>
          <span style={{ color: "#d4a853" }}>60-30-10 Payout</span>
          <span style={{ color: "#3f3f46" }}>/</span>
          <span style={{ color: "#a1a1aa" }}>21 Props</span>
          <span style={{ color: "#3f3f46" }}>/</span>
          <span style={{ color: "#a1a1aa" }}>Live</span>
        </div>

        {/* Bottom accent bar — Hawks green to Pats red */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "6px",
            background: `linear-gradient(90deg, ${HAWKS.primary}, ${PATS.primary})`,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
