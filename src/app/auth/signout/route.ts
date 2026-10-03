import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/server/auth";

export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
