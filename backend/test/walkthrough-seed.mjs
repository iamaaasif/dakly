// Seeds one realistic shop for the recorded walkthroughs (web and Android).
// Uses the same paths production uses: the REST API, a customer-list import, and a signed
// WhatsApp webhook for an incoming message. Prints {"email","password"} as JSON.
//   node test/walkthrough-seed.mjs [en|bn]
import { post, get, api, waInbound, uniq } from "./lib.mjs";

const lang = process.argv[2] === "bn" ? "bn" : "en";
const email = `walkthrough-${lang}-${uniq()}@dakly.test`;
const password = "Walkthrough#2026";
const must = (r, what) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.json)}`); return r.json; };

const reg = must(await post("/api/v1/auth/register", {
  name: lang === "bn" ? "রহিমা আক্তার" : "Rahima Akter",
  shop: lang === "bn" ? "রহিমা ফ্যাশন" : "Rahima Fashion",
  email, password, country: "BD", language: lang,
  // a distinct test client address, so repeated seeding is not caught by the per-IP signup limit
}, { headers: { "X-Forwarded-For": `198.51.100.${1 + Math.floor(Math.random() * 250)}` } }), "register");
const token = reg.token;

// A customer list like the ones sellers export from their order sheet.
const pre = lang === "bn" ? "01811" : "01711", intl = lang === "bn" ? "8801811" : "8801711";
const day = 86400000, iso = (d) => new Date(Date.now() - d * day).toISOString().slice(0, 10);
const rows = [
  ["Ayesha Begum", `${pre}-000101`, 48200, iso(4), 14],
  ["Nusrat Jahan", `${pre}-000102`, 31500, iso(9), 9],
  ["Farhana Islam", `${pre}-000103`, 22800, iso(15), 7],
  ["Sumi Akter", `${pre}-000104`, 12400, iso(21), 5],
  ["Karim Uddin", `${pre}-000105`, 9800, iso(75), 4],
  ["Tania Rahman", `${pre}-000106`, 7600, iso(92), 3],
  ["Mitu Sultana", `${pre}-000107`, 5400, iso(130), 2],
  ["Rumana Haque", `${pre}-000108`, 3900, iso(28), 2],
  ["Sharmin Nahar", `${pre}-000109`, 2100, iso(6), 1],
  ["Lipi Das", `${pre}-000110`, 1850, iso(3), 1],
  ["Jannat Ara", `${pre}-000111`, 1600, iso(2), 1],
  ["Mahmuda Khatun", `${pre}-000112`, 4200, iso(160), 2],
];
const csv = "Name,Phone,Total,Last order,Orders\n" + rows.map((r) => r.join(",")).join("\n");
const fd = new FormData();
fd.append("file", new Blob([csv], { type: "text/csv" }), "customers.csv");
must(await api("POST", "/api/v1/customers/import", { token, form: fd }), "import");

// A fresh first order today, so "new" customers and today's sales show up.
const c = must(await post("/api/v1/customers", { name: "Sadia Afrin", phone: `${pre}-000113`, amount: 2450, items: "Cotton three-piece" }, { token }), "customer");

// The shop writes first (on the shared Dakly number an inbound reply is routed to the shop that
// last messaged that person), then two customers write back, signed exactly like Meta signs them.
const ayesha = must(await get(`/api/v1/customers?q=${pre}000101`, { token }), "find").items[0];
must(await post(`/api/v1/inbox/${ayesha.id}`, { text: lang === "bn" ? "আপা, আপনার জন্য নতুন কালেকশন আসছে!" : "Hi Ayesha, new arrivals are coming this week!" }, { token }), "outbound");
must(await post(`/api/v1/inbox/${c.id}`, { text: lang === "bn" ? "আপনার অর্ডার পেয়েছি, ধন্যবাদ!" : "Thanks for your order!" }, { token }), "outbound2");
await waInbound("109876543210", `${intl}000101`, lang === "bn" ? "আপা, নতুন ঈদ কালেকশন কবে আসবে?" : "Hi! When does the new Eid collection arrive?", undefined, "Ayesha Begum");
await waInbound("109876543210", `${intl}000113`, lang === "bn" ? "ডেলিভারি কবে পাবো?" : "When will my order be delivered?", undefined, "Sadia Afrin");

const inbox = must(await get("/api/v1/inbox", { token }), "inbox");
if (inbox.unreadTotal < 2) throw new Error(`expected 2 unread WhatsApp messages, got ${inbox.unreadTotal}`);

// Something for the AI to know about the shop.
await post("/api/v1/knowledge", { type: "faq", title: lang === "bn" ? "ডেলিভারি" : "Delivery", body: lang === "bn" ? "ঢাকার ভেতরে ২ দিন, বাইরে ৩-৫ দিন। ঢাকায় ৭০ টাকা, বাইরে ১২০ টাকা।" : "Inside Dhaka 2 days, outside 3-5 days. Delivery fee 70 taka in Dhaka, 120 outside." }, { token });

console.log(JSON.stringify({ email, password, customerId: c.id }));
