import { NextRequest, NextResponse } from "next/server";

import {
  clearAdminSessionCookie,
  hasAdminSession,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { getEnv } from "@/lib/env";

export async function GET() {
  return NextResponse.json({ authenticated: await hasAdminSession() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.pin !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.pin !== getEnv().adminPin) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  await clearAdminSessionCookie();
  return NextResponse.json({ authenticated: false });
}
