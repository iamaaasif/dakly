import { jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { encrypt } from "@/lib/crypto";
import { pagesFromCode } from "@/lib/facebook";
import { logError } from "@/lib/audit";

const page = (ok: boolean, text: string) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dakly</title>
<body style="font-family:system-ui,sans-serif;background:#f3f5f2;color:#13261d;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border:1px solid #d5dcd4;border-radius:16px;padding:24px;max-width:360px;text-align:center">
<h2 style="margin:0 0 8px">${ok ? "Facebook Page Connect হয়েছে" : "Connect হয়নি"}</h2><p>${text}</p>
<a href="dakly://open?path=/settings" style="display:inline-block;background:#c8402a;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">Dakly App-এ ফিরে যান</a></div></body>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } });

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  let shopId = "", fromApp = false, target = "/settings?fb=error", ok = false, note = "আবার চেষ্টা করুন।";
  try {
    // The signed state names the shop, so this also works in a browser without a Dakly login (app handoff)
    const { payload } = await jwtVerify(p.get("state") || "", new TextEncoder().encode(process.env.AUTH_SECRET));
    shopId = String(payload.shop); fromApp = !!payload.app;
    if (!p.get("code")) throw new Error(p.get("error_description") || "no code");
    const pages = await pagesFromCode(p.get("code")!, `${appUrl()}/api/facebook/callback`);
    if (!pages.length) { target = "/settings?fb=nopage"; note = "কোনো Page পাওয়া যায়নি, বা Page-এর অনুমতি দেওয়া হয়নি।"; throw new Error("no pages"); }
    const first = pages[0];
    await db.shop.update({ where: { id: shopId }, data: { fbPageId: first.id, fbPageName: first.name, fbPageToken: encrypt(first.token), fbPagesJson: encrypt(JSON.stringify(pages)) } });
    target = "/settings?fb=ok"; ok = true; note = `Post যাবে "${first.name}" Page-এ।`;
  } catch (e) {
    if (shopId) await logError("facebook", e, shopId);
  }
  if (fromApp) return page(ok, note);
  redirect(target);
}
