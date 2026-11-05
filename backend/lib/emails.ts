import "server-only";
import { sendMail, mailAdmins } from "./mail";
import { appUrl, supportEmail } from "./config";
import { PLANS, type PlanKey } from "./plans";

/** Every email Dakly sends to merchants, in Bangla or English (the user's panel language, else the shop's). */
type Who = { email: string; name: string; uiLang?: string | null; shop?: { name: string; language: string } | null };
const isBn = (u: Who) => (u.uiLang ?? u.shop?.language ?? "bn") === "bn";
const first = (u: Who) => u.name.split(" ")[0] || u.name;
const date = (d: Date, bn: boolean) => new Intl.DateTimeFormat(bn ? "en-GB" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" }).format(d);

export async function welcomeEmail(u: Who, pending: boolean) {
  const bn = isBn(u);
  const steps = bn
    ? ["১. Customer আনুন: Excel Upload, Store Connect, অথবা হাতে লিখে", "২. AI-কে দোকানের পণ্য, দাম আর নিয়ম শেখান", "৩. প্রথম Campaign পাঠান: Inactive Customer-দের ফিরিয়ে আনুন"]
    : ["1. Bring your customers in: Excel upload, store connect, or by hand", "2. Teach the AI your products, prices and policies", "3. Send your first campaign: win back inactive customers"];
  return sendMail(u.email,
    bn ? "Dakly-তে স্বাগতম" : "Welcome to Dakly",
    bn
      ? `আসসালামু আলাইকুম ${first(u)},\n\n${u.shop?.name ?? "আপনার দোকান"}-এর Dakly Account খোলা হয়েছে।${pending ? "\n\nআমরা Account-টা যাচাই করছি। চালু হলেই Email পাবেন।" : ""}\n\nশুরু করতে ৩টা কাজ:\n${steps.join("\n")}\n\n${appUrl()}/\n\nকোনো প্রশ্ন থাকলে এই Email-এর উত্তর দিন বা ${supportEmail()}-এ লিখুন।\n\nDakly টিম`
      : `Hi ${first(u)},\n\nThe Dakly account for ${u.shop?.name ?? "your shop"} is ready.${pending ? "\n\nWe are reviewing the account and will email you as soon as it is switched on." : ""}\n\nThree things to start:\n${steps.join("\n")}\n\n${appUrl()}/\n\nQuestions? Reply to this email or write to ${supportEmail()}.\n\nThe Dakly team`);
}

export async function newMerchantForAdmins(shopName: string, email: string, country: string, pending: boolean) {
  return mailAdmins(`${pending ? "[Approve] " : ""}New Dakly merchant: ${shopName}`, `${shopName} (${email}, ${country}) just signed up.${pending ? `\n\nApprove or reject:\n${appUrl()}/admin/merchants?f=pending` : ""}`);
}

export async function resetEmail(u: Who, link: string, hours: number) {
  const bn = isBn(u);
  return sendMail(u.email, bn ? "Dakly Password নতুন করুন" : "Reset your Dakly password",
    bn
      ? `আসসালামু আলাইকুম ${first(u)},\n\nনতুন Password দিতে এই Link-এ যান (${hours} ঘণ্টা কাজ করবে):\n${link}\n\nআপনি না চাইলে এই Email উপেক্ষা করুন, আপনার Password বদলাবে না।\n\nDakly`
      : `Hi ${first(u)},\n\nSet a new password with this link (valid for ${hours} hours):\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n\nDakly`);
}

export async function passwordChangedEmail(u: Who) {
  const bn = isBn(u);
  return sendMail(u.email, bn ? "আপনার Dakly Password বদলানো হয়েছে" : "Your Dakly password was changed",
    bn ? `আসসালামু আলাইকুম ${first(u)},\n\nআপনার Password এইমাত্র বদলানো হয়েছে, আর সব Device থেকে Logout করা হয়েছে।\n\nআপনি না করে থাকলে এখনই ${supportEmail()}-এ জানান।\n\nDakly`
      : `Hi ${first(u)},\n\nYour password was just changed and every device was signed out.\n\nIf this was not you, contact ${supportEmail()} right away.\n\nDakly`);
}

export async function receiptEmail(u: Who, p: { plan: string; months: number; amount: number; currency: string; tranId: string; id: string }, until: Date) {
  const bn = isBn(u);
  const plan = PLANS[p.plan as PlanKey]?.name ?? p.plan;
  const amt = `${new Intl.NumberFormat("en-IN").format(p.amount)} ${p.currency}`;
  return sendMail(u.email, bn ? `Payment রসিদ: Dakly ${plan}` : `Payment receipt: Dakly ${plan}`,
    bn
      ? `আসসালামু আলাইকুম ${first(u)},\n\nPayment পেয়েছি, ধন্যবাদ।\n\nPlan: ${plan} × ${p.months} মাস\nটাকা: ${amt}\nTransaction: ${p.tranId}\nমেয়াদ: ${date(until, bn)} পর্যন্ত\n\nরসিদ (Invoice):\n${appUrl()}/billing/invoice/${p.id}\n\nDakly`
      : `Hi ${first(u)},\n\nThank you, we received your payment.\n\nPlan: ${plan} × ${p.months} month(s)\nAmount: ${amt}\nTransaction: ${p.tranId}\nActive until: ${date(until, bn)}\n\nInvoice:\n${appUrl()}/billing/invoice/${p.id}\n\nDakly`);
}

export async function planEndingEmail(u: Who, plan: string, until: Date, ended: boolean) {
  const bn = isBn(u);
  const name = PLANS[plan as PlanKey]?.name ?? plan;
  const link = `${appUrl()}/billing`;
  if (ended)
    return sendMail(u.email, bn ? `Dakly ${name} Plan-এর মেয়াদ শেষ` : `Your Dakly ${name} plan has ended`,
      bn ? `আসসালামু আলাইকুম ${first(u)},\n\nআপনার ${name} Plan-এর মেয়াদ শেষ হয়েছে। Account এখন Free Plan-এ চলছে, কোনো Data মোছেনি।\n\nআবার চালু করতে:\n${link}\n\nDakly`
        : `Hi ${first(u)},\n\nYour ${name} plan has ended. Your account is on the Free plan now and no data was deleted.\n\nRenew here:\n${link}\n\nDakly`);
  return sendMail(u.email, bn ? `Dakly ${name} Plan শেষ হবে ${date(until, bn)}` : `Your Dakly ${name} plan ends on ${date(until, bn)}`,
    bn ? `আসসালামু আলাইকুম ${first(u)},\n\nআপনার ${name} Plan ${date(until, bn)}-এ শেষ হবে। তারপর Account Free Plan-এ চলে যাবে (মাসে কম Message, Voice Call বন্ধ)।\n\nমেয়াদ বাড়াতে:\n${link}\n\nDakly`
      : `Hi ${first(u)},\n\nYour ${name} plan ends on ${date(until, bn)}. After that the account moves to the Free plan (fewer messages, no voice calls).\n\nRenew here:\n${link}\n\nDakly`);
}

export async function limitWarningEmail(u: Who, used: number, limit: number) {
  const bn = isBn(u);
  return sendMail(u.email, bn ? "এই মাসের Message প্রায় শেষ" : "You have almost used this month's messages",
    bn ? `আসসালামু আলাইকুম ${first(u)},\n\nএই মাসে ${limit}টির মধ্যে ${used}টি Message পাঠানো হয়েছে। সীমা শেষ হলে Campaign আর Template Message বন্ধ থাকবে ১ তারিখ পর্যন্ত।\n\nPlan Upgrade:\n${appUrl()}/billing\n\nDakly`
      : `Hi ${first(u)},\n\nYou have sent ${used} of ${limit} messages this month. When the limit is reached, campaigns and template messages pause until the 1st.\n\nUpgrade:\n${appUrl()}/billing\n\nDakly`);
}
