// Demo data: npm run db:seed  →  login demo@dakly.app / demo1234
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const NAMES = ["রহিমা খাতুন", "নুসরাত জাহান", "তানভীর আহমেদ", "ফারহানা ইসলাম", "সুমাইয়া আক্তার", "মাহমুদ হোসেন", "জান্নাতুল ফেরদৌস", "আরিফুল ইসলাম", "সাবরিনা রহমান", "রাকিব চৌধুরী", "তাসলিমা বেগম", "শাহনাজ পারভীন", "মেহেদী হাসান", "নাসরিন সুলতানা", "ইমরান খান", "রুমানা আফরোজ", "সাকিব হাসান", "তানজিলা ইসলাম", "আয়েশা সিদ্দিকা", "কামরুল হাসান"];
const ITEMS = ["সুতি থ্রি-পিস", "কাশ্মীরি শাল", "কার্ডিগান", "জামদানি শাড়ি", "লেডিস কুর্তি", "হিজাব সেট"];

async function main() {
  await db.user.deleteMany({ where: { email: "demo@dakly.app" } });
  const user = await db.user.create({
    data: { email: "demo@dakly.app", name: "শারমিন আক্তার", passwordHash: await bcrypt.hash("demo1234", 10), shop: { create: { name: "রঙ্গন ফ্যাশন" } } },
    include: { shop: true },
  });
  const day = 86400000;
  // [orders, avg amount, days since last order, days between orders]
  const profiles: [number, number, number, number][] = [[17, 2500, 3, 20], [11, 2600, 7, 25], [6, 1500, 12, 30], [4, 1500, 74, 30], [1, 1850, 2, 0], [7, 1600, 95, 35], [5, 1550, 20, 30], [1, 2400, 9, 0], [3, 1600, 68, 40], [8, 1500, 15, 28], [2, 1600, 120, 60], [3, 1450, 45, 30], [2, 1200, 42, 20], [9, 2100, 5, 22], [1, 900, 80, 0], [4, 1700, 61, 25], [2, 2200, 4, 3], [1, 1300, 1, 0], [5, 3200, 85, 30], [3, 1100, 50, 25]];
  for (let i = 0; i < NAMES.length; i++) {
    const [n, avg, last, gap] = profiles[i];
    await db.customer.create({
      data: {
        shopId: user.shop!.id, name: NAMES[i], phone: `8801${7 + (i % 3)}${String(10000000 + i * 7919).slice(0, 8)}`, source: "excel",
        orders: { create: Array.from({ length: n }, (_, k) => ({ amount: Math.round(avg * (0.7 + ((i + k) % 5) * 0.15)), items: ITEMS[(i + k) % ITEMS.length], orderedAt: new Date(Date.now() - (last + k * gap) * day) })) },
      },
    });
  }
  await db.user.deleteMany({ where: { email: "admin@dakly.app" } });
  await db.user.create({ data: { email: "admin@dakly.app", name: "Dakly Admin", role: "admin", passwordHash: await bcrypt.hash("admin1234", 10) } });
  await db.shop.update({ where: { id: user.shop!.id }, data: { plan: "starter", planUntil: new Date(Date.now() + 20 * day) } });
  console.log("Seeded demo@dakly.app / demo1234 and admin@dakly.app / admin1234");
}
main().finally(() => db.$disconnect());
