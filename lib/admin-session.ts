import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getEnv } from "./env";

const ADMIN_COOKIE = "attendance_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 8;

function createSessionValue() {
  return createHmac("sha256", getEnv().adminSessionSecret)
    .update(getEnv().adminPin)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length != right.length) return false;
  return timingSafeEqual(left, right);
}

export async function hasAdminSession() {
  const store = await cookies();
  const current = store.get(ADMIN_COOKIE)?.value;
  if (!current) return false;
  return safeEqual(current, createSessionValue());
}

export async function assertAdminSession() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function setAdminSessionCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAdminSessionCookie() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
