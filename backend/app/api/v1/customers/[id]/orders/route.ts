import { apiAuth, out } from "@/lib/api";
import { addOrder } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth();
  if ("res" in a) return a.res;
  return out(await addOrder(a.shop, (await params).id, await req.json().catch(() => ({}))), 201);
}
