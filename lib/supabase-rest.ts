import { getEnv } from "./env";

export const TABLES = {
  logs: "office_logs",
  daySettings: "office_day_settings",
} as const;

export const COLUMNS = {
  eventTime: "event_time",
  eventType: "event_type",
  eventLabel: "event_label",
  leaveCategory: "leave_category",
} as const;

function buildUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${getEnv().supabaseUrl}/rest/v1/${cleanPath}`;
}

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      apikey: getEnv().supabaseServiceRoleKey,
      Authorization: `Bearer ${getEnv().supabaseServiceRoleKey}`,
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Supabase request failed (${response.status})${body ? `: ${body}` : ""}`,
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
