import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";

export function middleware(request: NextRequest) {
    return proxy(request);
}

export const config = {
    matcher: "/api/:path*",
};
