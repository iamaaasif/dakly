"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { readOptoutToken } from "@/lib/optout";

export async function optOutByLink(token: string) {
  const id = readOptoutToken(token);
  if (id) await db.customer.updateMany({ where: { id }, data: { optedOut: true } });
  redirect(`/u/${token}?done=1`);
}
