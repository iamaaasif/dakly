import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { shopOrNull } from "@/lib/auth";
import { appUrl, fbAppReady } from "@/lib/config";
import { fbLoginUrl } from "@/lib/facebook";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

export async function GET(req: Request) {
  const handoff = new URL(req.url).searchParams.get("handoff");
  let shopId: string | null = null;
  if (handoff) {
    try {
      const { payload } = await jwtVerify(handoff, secret());
      if (payload.typ !== "fb-handoff" || typeof payload.shop !== "string" || !payload.jti) throw new Error("bad");
      // One use only
      const used = await db.systemState.findUnique({ where: { key: `handoff:${payload.jti}` } });
      if (used) throw new Error("used");
      await db.systemState.create({ data: { key: `handoff:${payload.jti}`, value: "1" } });
      shopId = payload.shop;
    } catch {
      return new Response("এই Link-এর মেয়াদ শেষ। App-এ ফিরে আবার Connect চাপুন।", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  } else {
    const shop = await shopOrNull();
    if (!shop) redirect("/login");
    shopId = shop.id;
  }
  if (!fbAppReady()) redirect("/settings?fb=missing");
  const state = await new SignJWT({ shop: shopId, app: !!handoff }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("15m").sign(secret());
  redirect(fbLoginUrl(`${appUrl()}/api/facebook/callback`, state));
}
