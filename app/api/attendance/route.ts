import { NextRequest, NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-session";
import { COLUMNS, TABLES, supabaseRequest } from "@/lib/supabase-rest";

export async function POST(request: NextRequest) {
  const unauthorized = await assertAdminSession();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.eventType !== "string" || typeof body.eventTime !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!["IN", "OUT"].includes(body.eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  try {
    const inserted = await supabaseRequest(`${TABLES.logs}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        [COLUMNS.eventTime]: body.eventTime,
        [COLUMNS.eventType]: body.eventType,
      }),
    });

    return NextResponse.json(inserted);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
