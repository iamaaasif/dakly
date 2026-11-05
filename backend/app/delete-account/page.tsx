import type { Metadata } from "next";
import Link from "next/link";
import { getLoc } from "@/lib/i18n/server";
import { supportEmail } from "@/lib/config";
import { LangSwitch } from "@/components/LangSwitch";

export const metadata: Metadata = { title: "Delete your account · Dakly" };

export default async function DeleteAccountInfo({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const { lang } = await getLoc();
  const bn = lang === "bn";
  const email = supportEmail();
  return (
    <div className="shell" style={{ display: "block" }}>
      <main className="view" style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Link href="/" style={{ fontWeight: 800 }}>Dakly</Link><LangSwitch className="btn ghost sm" /></div>
        {done && <div className="okmsg" style={{ marginTop: 16 }}>{bn ? "আপনার Account আর সব তথ্য মুছে ফেলা হয়েছে।" : "Your account and all its data have been deleted."}</div>}
        <h1 style={{ marginTop: 16 }}>{bn ? "Dakly Account মুছে ফেলা" : "Delete your Dakly account"}</h1>
        <h2 style={{ fontSize: 19, marginTop: 16 }}>{bn ? "App বা Website থেকে" : "In the app or website"}</h2>
        <ol style={{ paddingLeft: 20, display: "grid", gap: 6, marginTop: 6 }}>
          {(bn
            ? ["Dakly-তে Login করুন।", "Settings খুলুন।", "একদম নিচে \"Account মুছে ফেলুন\"-এ যান।", "Password দিন, DELETE লিখুন, তারপর মুছে ফেলুন চাপুন।"]
            : ["Sign in to Dakly.", "Open Settings.", "Scroll to \"Delete account\" at the bottom.", "Enter your password, type DELETE and press Delete."]
          ).map((s) => <li key={s}>{s}</li>)}
        </ol>
        <p style={{ marginTop: 8 }}><Link className="btn primary" href="/settings#delete">{bn ? "Settings-এ যান" : "Go to Settings"}</Link></p>
        <h2 style={{ fontSize: 19, marginTop: 20 }}>{bn ? "Login করতে না পারলে" : "If you cannot sign in"}</h2>
        <p>{bn ? "যে Email দিয়ে Account খুলেছিলেন সেখান থেকে লিখুন" : "Email us from the address you signed up with:"} <a href={`mailto:${email}?subject=Delete%20my%20Dakly%20account`} style={{ color: "var(--dak)" }}>{email}</a>{bn ? "। ৭ দিনের মধ্যে মুছে দেওয়া হবে।" : ". We delete it within 7 days."}</p>
        <h2 style={{ fontSize: 19, marginTop: 20 }}>{bn ? "কী মুছে যায়" : "What is deleted"}</h2>
        <p>{bn
          ? "আপনার Login, দোকান, সব Customer আর Order, Campaign ও Message, WhatsApp কথোপকথন, Facebook Post, AI Knowledge, Store ও Facebook Connection, Support Ticket আর Payment-এর তথ্য। সাথে সাথে মূল Database থেকে মুছে যায়; Backup থেকে ৩০ দিনের মধ্যে।"
          : "Your login, shop, all customers and orders, campaigns and messages, WhatsApp conversations, Facebook posts, AI knowledge, store and Facebook connections, support tickets and payment records. They are removed from the live database immediately and from backups within 30 days."}</p>
        <p className="muted" style={{ marginTop: 12 }}><Link href="/privacy">{bn ? "গোপনীয়তা নীতি" : "Privacy Policy"}</Link></p>
      </main>
    </div>
  );
}
