import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Dev mode: skip auth check (using localStorage tokens, not accessible in middleware)
  // Auth is handled client-side by AuthProvider
  return NextResponse.next();
}

export const config = {
  matcher: ["/mypage/:path*", "/admin/:path*"],
};
