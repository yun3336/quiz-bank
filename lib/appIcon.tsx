import { ImageResponse } from "next/og";

export function appIconImage(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#00686B",
          color: "#ffffff",
          fontSize: Math.round(size * 0.5),
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        題
      </div>
    ),
    { width: size, height: size },
  );
}
