import { NextRequest, NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-session";
import { TABLES, supabaseRequest } from "@/lib/supabase-rest";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: Context) {
  const unauthorized = await assertAdminSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await supabaseRequest(`${TABLES.logs}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
