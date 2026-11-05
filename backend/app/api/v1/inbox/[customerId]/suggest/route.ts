import { apiAuth, ok, fail } from "@/lib/api";
import { suggestReply } from "@/lib/ai";
import { withAi, AiLimitError } from "@/lib/usage";

/** AI draft of the next reply, from the knowledge base, order history and the conversation. Not sent. */
export async function POST(_: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  const { customerId } = await params;
  try { return ok({ text: await withAi(a.shop, "reply", () => suggestReply(a.shop, customerId)) }); }
  catch (e) { return e instanceof AiLimitError ? fail(e.message, 429, "limit_reached") : fail("AI উত্তর লিখতে পারেনি", 500); }
}
