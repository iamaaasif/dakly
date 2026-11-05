import { z } from "zod";
import { apiAuth, body, out } from "@/lib/api";
import { writePost } from "@/lib/services";

export async function POST(req: Request) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const b = await body(req, z.object({ prompt: z.string().min(3), tone: z.string().default("বন্ধুসুলভ") }));
  if ("res" in b) return b.res;
  return out(await writePost(a.shop, b.data));
}
