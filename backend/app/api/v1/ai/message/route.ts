import { z } from "zod";
import { apiAuth, body, out } from "@/lib/api";
import { writeMessage } from "@/lib/services";

export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ segment: z.string().default("all"), offer: z.string().default(""), channel: z.enum(["text", "voice"]).default("text") }));
  if ("res" in b) return b.res;
  return out(await writeMessage(a.shop, b.data));
}
