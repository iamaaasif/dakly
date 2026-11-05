import { requireShop } from "@/lib/auth";
import { SettingsForm, StoreForm } from "@/components/SettingsForm";
import { logout, choosePage, disconnectFacebook } from "@/app/actions";
import { channelConfig, fbAppReady } from "@/lib/config";
import { usedThisMonth } from "@/lib/send";
import { aiEnabled } from "@/lib/ai";
import { decrypt } from "@/lib/crypto";
import { getLoc } from "@/lib/i18n/server";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { PasswordForm } from "@/components/PasswordForm";
import Link from "next/link";
import { headers } from "next/headers";
import { handoffToken } from "@/lib/handoff";
import { messageLimit } from "@/lib/plans";

const FB_MSG: Record<string, [string, string]> = {
  ok: ["okmsg", "Facebook Page Connect হয়েছে।"],
  error: ["err", "Facebook Connect হয়নি। আবার চেষ্টা করুন।"],
  nopage: ["err", "আপনার Account-এ কোনো Page পাওয়া যায়নি, বা Page-এর অনুমতি দেওয়া হয়নি।"],
  missing: ["err", "Server-এ FB_APP_ID আর FB_APP_SECRET দেওয়া নেই।"],
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ fb?: string }> }) {
  const { fb } = await searchParams;
  const { shop, user } = await requireShop();
  const { t, f } = await getLoc();
  const cfg = channelConfig(shop);
  const pages = (JSON.parse(decrypt(shop.fbPagesJson) || "[]") as { id: string; name: string }[]);
  const limit = messageLimit(shop);
  const used = await usedThisMonth(shop.id);
  const inApp = ((await headers()).get("user-agent") || "").includes("DaklyAndroid");
  const fbHref = inApp ? `/api/facebook/connect?handoff=${await handoffToken(shop.id)}` : "/api/facebook/connect";
  const state = (c: { own: boolean } | null) => (c ? (c.own ? "own" : "platform") : "off");
  return (
    <>
      <div className="greet"><h2>Settings</h2><p>{user.email}</p></div>
      <div className="row-btns mob-only"><a className="btn ghost sm" href="/billing">{t("Plan ও Payment")}</a><a className="btn ghost sm" href="/knowledge">AI Knowledge</a><a className="btn ghost sm" href="/reports">{t("রিপোর্ট")}</a><a className="btn ghost sm" href="/support">Support</a><a className="btn ghost sm" href="/alerts">Notification</a></div>
      {fb && FB_MSG[fb] && <div className={FB_MSG[fb][0]}>{t(FB_MSG[fb][1])}</div>}
      {!aiEnabled() && <div className="err">{t("Server-এ OPENAI_API_KEY দেওয়া নেই। AI লেখা আর Voice চলবে না, সাধারণ Template ব্যবহার হবে।")}</div>}
      {limit >= 0 && <div className="card"><div className="sec-h"><h3>{t("এই মাসের Message")}</h3><b className="num">{f.n(used)} / {f.n(limit)}</b></div><div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%`, background: "var(--dak)" }} /></div></div>}

      <div className="card form" style={{ maxWidth: 720 }}>
        <div className="sec-h"><h3>Facebook Page</h3><span className={`badge ${cfg.fb ? "b-sent" : "b-test"}`}>{cfg.fb ? "Connected" : t("Connect করা নেই")}</span></div>
        {cfg.fb ? <p>{t("Post যাবে এই Page-এ:")} <b>{cfg.fb.name ?? cfg.fb.pageId}</b></p> : <p className="muted">{t("AI-লেখা Post নিজে থেকে Publish করতে আপনার Page Connect করুন।")}</p>}
        {pages.length > 1 && (
          <form action={choosePage} className="row-btns">
            <select className="input" name="page" defaultValue={shop.fbPageId ?? ""} style={{ flex: 1, minWidth: 180 }} aria-label="Page">{pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <button className="btn ghost">{t("এই Page ব্যবহার করুন")}</button>
          </form>
        )}
        <div className="row-btns">
          {!fbAppReady() && <p className="muted">{t("Server-এ FB_APP_ID আর FB_APP_SECRET দিলে এখানে Connect বোতাম আসবে।")}</p>}
          {fbAppReady() && <a className="btn primary" href={fbHref}>{cfg.fb ? t("আবার Connect করুন") : t("Facebook দিয়ে Connect করুন")}</a>}
          {cfg.fb && <form action={disconnectFacebook}><button className="btn ghost">Disconnect</button></form>}
        </div>
      </div>

      <div className="card form" style={{ maxWidth: 720 }} id="store">
        <div className="sec-h"><h3>Online Store</h3><span className={`badge ${shop.storeType ? "b-sent" : "b-test"}`}>{shop.storeType ? (shop.storeType === "shopify" ? "Shopify" : "WooCommerce") : t("Connect করা নেই")}</span></div>
        {shop.storeType && <p className="muted">{t("শেষ Sync:")} {shop.storeSyncedAt ? f.dt(shop.storeSyncedAt) : t("এখনো হয়নি")}{shop.storeError ? ` · ${t("সমস্যা:")} ${shop.storeError}` : ""}</p>}
        <StoreForm connected={!!shop.storeType} type={shop.storeType ?? "woocommerce"} url={shop.storeUrl ?? ""} />
      </div>

      <SettingsForm
        values={{ name: shop.name, country: shop.country, currency: shop.currency, timezone: shop.timezone, language: shop.language, waPhoneNumberId: shop.waPhoneNumberId ?? "", waTemplateName: shop.waTemplateName ?? "", waTemplateLang: shop.waTemplateLang ?? "bn",
          smsApiUrl: shop.smsApiUrl ?? "", smsSenderId: shop.smsSenderId ?? "", twilioSid: shop.twilioSid ?? "", twilioFrom: shop.twilioFrom ?? "" }}
        has={{ waAccessToken: !!shop.waAccessToken, smsApiKey: !!shop.smsApiKey, twilioToken: !!shop.twilioToken }}
        state={{ wa: state(cfg.wa), sms: state(cfg.sms), voice: state(cfg.voice) }}
      />
      <div className="card form" style={{ maxWidth: 720 }} id="password">
        <h3 style={{ fontSize: 17 }}>{t("Password বদলান")}</h3>
        <PasswordForm />
      </div>
      <form action={logout}><button className="btn ghost">Logout</button></form>
      <div className="card form" style={{ maxWidth: 720, borderColor: "var(--bad)" }} id="delete">
        <h3 style={{ fontSize: 17, color: "var(--bad)" }}>{t("Account মুছে ফেলুন")}</h3>
        <p className="muted">{t("আপনার দোকান, সব Customer, Order, Campaign, Message, Post আর AI Knowledge চিরতরে মুছে যাবে। এটা আর ফেরানো যাবে না।")} <Link href="/privacy" style={{ color: "var(--accent)" }}>{t("Privacy Policy")}</Link></p>
        <DeleteAccountForm />
      </div>
    </>
  );
}
