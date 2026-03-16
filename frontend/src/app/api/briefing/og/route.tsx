import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const available = searchParams.get("available") || "0";
  const urgent = searchParams.get("urgent") || "0";
  const total = searchParams.get("total") || "—";
  const company = searchParams.get("company") || "";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0B1117",
          padding: "48px 56px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        {/* Top label */}
        <div
          style={{
            display: "flex",
            color: "#7B919E",
            fontSize: 18,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          INTELLIGENCE BRIEFING
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", color: "#7B919E", fontSize: 20 }}>
            📊 이번 주 우리 회사 과제 기회
          </div>
          <div
            style={{
              display: "flex",
              color: "#F0F4F8",
              fontSize: 72,
              fontWeight: 700,
            }}
          >
            {total}원
          </div>
          <div style={{ display: "flex", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#F0F4F8",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {available}건
              </span>
              <span style={{ color: "#7B919E", fontSize: 18 }}>신청 가능</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#C23030",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {urgent}건
              </span>
              <span style={{ color: "#7B919E", fontSize: 18 }}>마감 임박</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <span style={{ color: "#7B919E", fontSize: 18 }}>{company}</span>
          <span
            style={{ color: "#2D72D2", fontSize: 20, fontWeight: 600 }}
          >
            danbi.forlabs.io
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
