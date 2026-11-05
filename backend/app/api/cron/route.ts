import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { tick } from "@/lib/send";
import { env } from "@/lib/config";

const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Call every minute (e.g. system cron, Railway cron, cron-job.org): GET /api/cron?key=CRON_SECRET */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key") || req.headers.get("authorization")?.replace("Bearer ", "");
  const secret = env("CRON_SECRET");
  if (!secret || !key || !same(key, secret)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await tick());
}
