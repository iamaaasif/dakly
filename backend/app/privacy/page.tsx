import type { Metadata } from "next";
import Link from "next/link";
import { getLoc } from "@/lib/i18n/server";
import { supportEmail } from "@/lib/config";
import { LangSwitch } from "@/components/LangSwitch";

export const metadata: Metadata = { title: "Privacy Policy · Dakly" };
const UPDATED = "2026-11-04";

type Sec = [string, string[]];
const EN: { title: string; intro: string; s: Sec[] } = {
  title: "Privacy Policy",
  intro: "Dakly helps shop owners keep in touch with their customers. This page explains what Dakly stores, why, who it is shared with, how long it is kept and how to delete it.",
  s: [
    ["What we store", [
      "Your account: name, email address and a hashed password (we never store the password itself).",
      "Your shop: shop name, country, currency, time zone, language, plan and payment history.",
      "Your customers, which you add: names, phone numbers, optional email and area, orders (items, amounts, dates), notes and whether they asked to stop messages.",
      "Messages: campaigns you send, WhatsApp conversations with your customers, delivery and read status, and call results.",
      "AI knowledge you enter: products, prices, policies, FAQs and brand voice.",
      "Connections: your Facebook Page access token, your own WhatsApp, SMS or Twilio keys if you add them (encrypted), and online store keys (Shopify/WooCommerce).",
      "Technical logs: sign-in attempts (email and IP address, kept 24 hours) and error logs.",
    ]],
    ["Why we use it", [
      "To run the service you asked for: group customers, write and send messages, place calls, publish posts, show reports and give daily suggestions.",
      "To keep accounts secure, prevent abuse and support you when you contact us.",
      "We do not sell personal data and we do not use your customers' data for our own marketing.",
    ]],
    ["Who processes it for us", [
      "OpenAI: text you ask the AI to write, voice recordings for voice input (speech to text), and call scripts (text to speech). OpenAI does not use API data to train its models.",
      "Meta (WhatsApp Cloud API and Facebook): messages to your customers and posts to your Page.",
      "SMS gateways and Twilio: SMS messages and phone calls to your customers.",
      "SSLCommerz (Bangladesh) and Stripe (other countries): plan payments. We never see or store card numbers.",
      "Our hosting and email providers, to run the service and send account emails.",
    ]],
    ["How long we keep it", [
      "As long as your account is open. Daily AI suggestions are replaced every day; sign-in attempts are deleted after 24 hours.",
      "When you delete your account, your shop, customers, orders, messages, campaigns, posts, knowledge and payment records are deleted immediately from the live database. Backups are overwritten within 30 days.",
    ]],
    ["Your customers' rights", [
      "Customers can reply STOP (or the same word in their language) on WhatsApp to stop messages. You can also turn messages off for a customer.",
      "As the shop owner you are responsible for having your customers' permission to contact them. Dakly processes their data for you.",
    ]],
    ["Your choices", [
      "You can edit or delete any customer, knowledge item or post at any time, disconnect Facebook or your store, and delete your whole account in Settings.",
      "See how to delete your account: /delete-account",
    ]],
    ["Security", ["Connections use HTTPS. Passwords are hashed, and access tokens and keys are encrypted at rest (AES-256-GCM)."]],
    ["Children", ["Dakly is a business tool and is not meant for anyone under 18."]],
  ],
};
const BN: typeof EN = {
  title: "গোপনীয়তা নীতি (Privacy Policy)",
  intro: "Dakly দোকানের মালিকদের পুরোনো Customer-দের সাথে যোগাযোগ রাখতে সাহায্য করে। Dakly কী তথ্য রাখে, কেন রাখে, কার সাথে শেয়ার হয়, কতদিন থাকে আর কীভাবে মুছবেন, তা এখানে লেখা আছে।",
  s: [
    ["আমরা কী তথ্য রাখি", [
      "আপনার Account: নাম, Email আর Password-এর Hash (আসল Password কখনো রাখা হয় না)।",
      "আপনার দোকান: দোকানের নাম, দেশ, মুদ্রা, Time zone, ভাষা, Plan আর Payment-এর ইতিহাস।",
      "আপনার যোগ করা Customer: নাম, ফোন নম্বর, Email ও এলাকা (ঐচ্ছিক), Order (পণ্য, টাকা, তারিখ), Note আর উনি Message বন্ধ করতে বলেছেন কিনা।",
      "Message: আপনার পাঠানো Campaign, Customer-দের সাথে WhatsApp কথোপকথন, পৌঁছানো/পড়ার অবস্থা আর Call-এর ফল।",
      "AI Knowledge: আপনার লেখা পণ্য, দাম, নিয়ম, প্রশ্ন-উত্তর আর কথার ধরন।",
      "Connection: আপনার Facebook Page-এর Access Token, নিজের WhatsApp/SMS/Twilio Key দিলে সেগুলো (Encrypted), আর Online Store-এর Key (Shopify/WooCommerce)।",
      "Technical Log: Login-এর চেষ্টা (Email ও IP, ২৪ ঘণ্টা রাখা হয়) আর Error Log।",
    ]],
    ["কেন ব্যবহার করি", [
      "আপনি যে সেবা চেয়েছেন তা চালাতে: Customer ভাগ করা, Message লেখা ও পাঠানো, Call করা, Post Publish করা, রিপোর্ট আর দৈনিক পরামর্শ দেখানো।",
      "Account নিরাপদ রাখতে, অপব্যবহার ঠেকাতে, আর আপনি যোগাযোগ করলে সাহায্য করতে।",
      "আমরা কারো ব্যক্তিগত তথ্য বিক্রি করি না, আর আপনার Customer-দের তথ্য নিজেদের Marketing-এ ব্যবহার করি না।",
    ]],
    ["কারা আমাদের হয়ে তথ্য Process করে", [
      "OpenAI: AI-কে লিখতে বলা লেখা, Voice Input-এর রেকর্ডিং (কথা থেকে লেখা), আর Call-এর Script (লেখা থেকে কথা)। OpenAI API-র তথ্য দিয়ে Model Train করে না।",
      "Meta (WhatsApp Cloud API ও Facebook): Customer-দের Message আর আপনার Page-এর Post।",
      "SMS Gateway ও Twilio: Customer-দের SMS আর ফোন Call।",
      "SSLCommerz (বাংলাদেশ) ও Stripe (অন্যান্য দেশ): Plan-এর Payment। Card নম্বর আমরা দেখি না, রাখিও না।",
      "Hosting আর Email Provider, সেবা চালাতে আর Account-এর Email পাঠাতে।",
    ]],
    ["কতদিন রাখি", [
      "আপনার Account যতদিন খোলা থাকে। দৈনিক AI পরামর্শ প্রতিদিন বদলায়; Login-এর চেষ্টা ২৪ ঘণ্টা পর মুছে যায়।",
      "Account মুছলে আপনার দোকান, Customer, Order, Message, Campaign, Post, Knowledge আর Payment-এর তথ্য সাথে সাথে মূল Database থেকে মুছে যায়। Backup ৩০ দিনের মধ্যে মুছে যায়।",
    ]],
    ["আপনার Customer-দের অধিকার", [
      "Customer WhatsApp-এ STOP বা \"বন্ধ\" (বা নিজের ভাষায় একই কথা) লিখলে আর Message যাবে না। আপনিও কোনো Customer-এর Message বন্ধ করতে পারেন।",
      "দোকানের মালিক হিসেবে Customer-দের সাথে যোগাযোগের অনুমতি থাকা আপনার দায়িত্ব। Dakly আপনার হয়ে তাঁদের তথ্য Process করে।",
    ]],
    ["আপনার নিয়ন্ত্রণ", [
      "যেকোনো Customer, Knowledge বা Post যেকোনো সময় বদলাতে বা মুছতে পারেন, Facebook বা Store Disconnect করতে পারেন, আর Settings থেকে পুরো Account মুছে ফেলতে পারেন।",
      "Account মোছার নিয়ম: /delete-account",
    ]],
    ["নিরাপত্তা", ["সব Connection HTTPS-এ চলে। Password Hash করা থাকে, আর Token ও Key Encrypt করে রাখা হয় (AES-256-GCM)।"]],
    ["শিশু", ["Dakly ব্যবসার জন্য তৈরি, ১৮ বছরের কম বয়সীদের জন্য নয়।"]],
  ],
};

export default async function Privacy() {
  const { lang } = await getLoc();
  const c = lang === "bn" ? BN : EN;
  const email = supportEmail();
  return (
    <div className="shell" style={{ display: "block" }}>
      <main className="view" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Link href="/" style={{ fontWeight: 800 }}>Dakly</Link><LangSwitch className="btn ghost sm" /></div>
        <h1 style={{ marginTop: 16 }}>{c.title}</h1>
        <p className="muted">{lang === "bn" ? "সর্বশেষ আপডেট" : "Last updated"}: {UPDATED}</p>
        <p style={{ marginTop: 12 }}>{c.intro}</p>
        {c.s.map(([h, items]) => (
          <section key={h} style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 19 }}>{h}</h2>
            <ul style={{ paddingLeft: 20, display: "grid", gap: 6, marginTop: 6 }}>{items.map((i) => <li key={i}>{i.includes("/delete-account") ? <>{i.replace("/delete-account", "")}<Link href="/delete-account" style={{ color: "var(--accent)" }}>/delete-account</Link></> : i}</li>)}</ul>
          </section>
        ))}
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 19 }}>{lang === "bn" ? "যোগাযোগ" : "Contact"}</h2>
          <p>{lang === "bn" ? "প্রশ্ন বা অনুরোধ থাকলে লিখুন:" : "Questions or requests:"} <a href={`mailto:${email}`} style={{ color: "var(--accent)" }}>{email}</a></p>
        </section>
      </main>
    </div>
  );
}
