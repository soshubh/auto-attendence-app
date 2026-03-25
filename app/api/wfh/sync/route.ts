import { NextRequest, NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-session";
import { COLUMNS, TABLES, supabaseRequest } from "@/lib/supabase-rest";

type WfhDate = {
  date: string;
};

type WfhSyncBody = {
  dates: unknown[];
};

type ExistingWfhRecord = {
  id: number;
  date: string;
};

export async function POST(request: NextRequest) {
  const unauthorized = await assertAdminSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as WfhSyncBody | null;
  if (!body || !Array.isArray(body.dates)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const nextDates: WfhDate[] = body.dates
    .filter((item): item is WfhDate => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      return typeof value.date === "string";
    })
    .map((item) => ({ date: item.date }))
    .sort((a, b) => a.date.localeCompare(b.date));

  try {
    const currentWfhRows = await supabaseRequest<Array<Record<string, string | number | null>>>(
      `${TABLES.logs}?event_type=eq.WFH&order=${COLUMNS.eventTime}.desc&limit=5000`,
    );

    const currentByDate = new Map<string, ExistingWfhRecord>();
    currentWfhRows.forEach((row) => {
      const rawTime = row[COLUMNS.eventTime];
      if (typeof rawTime !== "string") return;
      const date = rawTime.slice(0, 10);
      if (!currentByDate.has(date)) {
        currentByDate.set(date, { id: Number(row.id), date });
      }
    });

    const nextDateKeys = new Set(nextDates.map((item) => item.date));
    const datesToInsert = nextDates.filter((item) => !currentByDate.has(item.date));
    const datesToDelete = [...currentByDate.values()].filter(
      (item) => !nextDateKeys.has(item.date),
    );

    await Promise.all(
      datesToInsert.map((item) =>
        supabaseRequest(`${TABLES.logs}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            [COLUMNS.eventType]: "WFH",
            [COLUMNS.eventTime]: `${item.date}T00:00:00`,
          }),
        }),
      ),
    );

    await Promise.all(
      datesToDelete.map((item) =>
        supabaseRequest(`${TABLES.logs}?id=eq.${item.id}`, {
          method: "DELETE",
          headers: {
            Prefer: "return=minimal",
          },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
