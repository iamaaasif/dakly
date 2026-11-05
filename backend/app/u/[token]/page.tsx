import type { Metadata } from "next";
import { db } from "@/lib/db";
import { readOptoutToken } from "@/lib/optout";
import { optOutByLink } from "./actions";

export const metadata: Metadata = { title: "Unsubscribe · Dakly", robots: { index: false } };

/** Public opt-out page linked from SMS campaigns. Customers see it in the shop's language. */
export default async function Unsubscribe({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const id = readOptoutToken(token);
  const c = id ? await db.customer.findUnique({ where: { id }, include: { shop: true } }) : null;
  const bn = (c?.shop.language ?? "bn") === "bn";
  return (
    <div className="shell" style={{ display: "block" }}>
      <main className="view" style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px" }}>
        <div className="card form">
          {!c ? <p>{bn ? "Link-টা ঠিক নেই।" : "This link is not valid."}</p>
            : c.optedOut || done ? <><h2>{bn ? "বন্ধ করা হয়েছে" : "You are unsubscribed"}</h2><p>{bn ? `${c.shop.name} আপনাকে আর Offer পাঠাবে না।` : `${c.shop.name} will not send you offers any more.`}</p></>
            : <>
                <h2>{bn ? `${c.shop.name}-এর Message বন্ধ করবেন?` : `Stop messages from ${c.shop.name}?`}</h2>
                <p className="muted">{bn ? "আপনি আর Offer বা Campaign Message পাবেন না।" : "You will no longer get offers or campaign messages."}</p>
                <form action={optOutByLink.bind(null, token)}><button className="btn primary">{bn ? "হ্যাঁ, বন্ধ করুন" : "Yes, unsubscribe"}</button></form>
              </>}
        </div>
      </main>
    </div>
  );
}
