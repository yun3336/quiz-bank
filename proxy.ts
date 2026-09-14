import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VENDORS = new Set(["cisco", "huawei", "language", "math", "science", "career"]);

export function proxy(request: NextRequest) {
  const vendor = request.nextUrl.searchParams.get("vendor");
  if (!vendor || !VENDORS.has(vendor)) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set("quiz-bank-vendor", vendor, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/practice", "/exam", "/review", "/stats", "/lab", "/lab/:path*"],
};
