import { NextRequest, NextResponse } from "next/server";

import { assertAdminSession } from "@/lib/admin-session";
import { COLUMNS, TABLES, supabaseRequest } from "@/lib/supabase-rest";

type LeaveDate = {
  date: string;
  category: string;
  label?: string;
};

type LeaveSyncBody = {
  weekdays: unknown[];
  dates: unknown[];
};

type ExistingLeaveRecord = {
  id: number;
  date: string;
  category: string;
  label: string;
};

export async function POST(request: NextRequest) {
  const unauthorized = await assertAdminSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => null)) as LeaveSyncBody | null;
  if (!body || !Array.isArray(body.weekdays) || !Array.isArray(body.dates)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const nextWeekdays = [...new Set(body.weekdays)]
    .filter((weekday): weekday is number =>
      typeof weekday === "number" && Number.isInteger(weekday) && weekday >= 0 && weekday <= 6,
    )
    .sort((a, b) => a - b);
  const nextDates: LeaveDate[] = body.dates
    .filter((item): item is LeaveDate => {
      if (!item || typeof item !== "object") return false;
      const value = item as Record<string, unknown>;
      return (
        typeof value.date === "string" &&
        typeof value.category === "string" &&
        (typeof value.label === "string" || typeof value.label === "undefined")
      );
    })
    .map((item) => ({
      date: item.date,
      category: item.category,
      label: typeof item.label === "string" ? item.label : "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  try {
    const [settings, currentLeaves] = await Promise.all([
      supabaseRequest<Array<{ weekday: number; setting_type: string }>>(
        `${TABLES.daySettings}?setting_type=eq.LEAVE_WEEKDAY&order=weekday.asc`,
      ),
      supabaseRequest<Array<Record<string, string | number | null>>>(
        `${TABLES.logs}?event_type=eq.LEAVE&order=${COLUMNS.eventTime}.desc&limit=5000`,
      ),
    ]);

    const currentWeekdays = settings.map((item) => item.weekday);
    const currentLeavesByDate = new Map<string, ExistingLeaveRecord>();

    currentLeaves.forEach((row) => {
      const rawTime = row[COLUMNS.eventTime];
      if (typeof rawTime !== "string") return;
      const date = rawTime.slice(0, 10);
      const rawCategory = row[COLUMNS.leaveCategory];
      const rawLabel = row[COLUMNS.eventLabel];
      if (!currentLeavesByDate.has(date)) {
        currentLeavesByDate.set(date, {
          id: Number(row.id),
          date,
          category: typeof rawCategory === "string" ? rawCategory : "",
          label: typeof rawLabel === "string" ? rawLabel : "",
        });
      }
    });

    const currentSet = new Set(currentWeekdays);
    const nextSet = new Set(nextWeekdays);
    const weekdaysToInsert = nextWeekdays.filter((weekday) => !currentSet.has(weekday));
    const weekdaysToDelete = currentWeekdays.filter((weekday) => !nextSet.has(weekday));

    await Promise.all(
      weekdaysToInsert.map((weekday) =>
        supabaseRequest(`${TABLES.daySettings}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            setting_type: "LEAVE_WEEKDAY",
            weekday,
          }),
        }),
      ),
    );

    await Promise.all(
      weekdaysToDelete.map((weekday) =>
        supabaseRequest(
          `${TABLES.daySettings}?setting_type=eq.LEAVE_WEEKDAY&weekday=eq.${weekday}`,
          {
            method: "DELETE",
            headers: {
              Prefer: "return=minimal",
            },
          },
        ),
      ),
    );

    const nextDateKeys = new Set(nextDates.map((item) => item.date));
    const datesToInsert = nextDates.filter((item) => !currentLeavesByDate.has(item.date));
    const datesToUpdate = nextDates.filter((item) => {
      const existing = currentLeavesByDate.get(item.date);
      return (
        existing &&
        (existing.category !== item.category || (existing.label || "") !== (item.label || ""))
      );
    });
    const datesToDelete = [...currentLeavesByDate.values()].filter(
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
            [COLUMNS.eventType]: "LEAVE",
            [COLUMNS.eventTime]: `${item.date}T00:00:00`,
            [COLUMNS.leaveCategory]: item.category,
            [COLUMNS.eventLabel]: item.label || null,
          }),
        }),
      ),
    );

    await Promise.all(
      datesToUpdate.map((item) => {
        const existing = currentLeavesByDate.get(item.date)!;
        return supabaseRequest(`${TABLES.logs}?id=eq.${existing.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            [COLUMNS.leaveCategory]: item.category,
            [COLUMNS.eventLabel]: item.label || null,
          }),
        });
      }),
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
