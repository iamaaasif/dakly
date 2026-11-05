import "server-only";
import { SignJWT } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET);

/** One-time 5-minute token so the Android app can finish Facebook login in the phone's browser (Facebook blocks OAuth in WebViews). */
export async function handoffToken(shopId: string) {
  return new SignJWT({ shop: shopId, typ: "fb-handoff" }).setProtectedHeader({ alg: "HS256" }).setJti(crypto.randomUUID()).setExpirationTime("5m").sign(secret());
}

