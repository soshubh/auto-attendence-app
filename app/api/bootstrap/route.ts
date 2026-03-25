import { NextResponse } from "next/server";

import { hasAdminSession } from "@/lib/admin-session";
import { COLUMNS, TABLES, supabaseRequest } from "@/lib/supabase-rest";

export async function GET() {
  try {
    const [rows, settings] = await Promise.all([
      supabaseRequest(`${TABLES.logs}?order=${COLUMNS.eventTime}.desc&limit=1000`),
      supabaseRequest(`${TABLES.daySettings}?order=weekday.asc`),
    ]);

    return NextResponse.json({
      rows,
      settings,
      adminAuthenticated: await hasAdminSession(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
