import type { ChannelConfig } from "./config";
type FB = NonNullable<ChannelConfig["fb"]>;
const V = "v21.0";

/** Publishes a text post to the shop's Facebook Page. */
export async function publishToPage(cfg: FB, message: string) {
  const res = await fetch(`https://graph.facebook.com/${V}/${cfg.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: cfg.token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Facebook error ${res.status}`);
  return String(data.id ?? "");
}

export function fbLoginUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.FB_APP_ID || "", redirect_uri: redirectUri, state,
    scope: "pages_show_list,pages_manage_posts,pages_read_engagement", response_type: "code",
  });
  return `https://www.facebook.com/${V}/dialog/oauth?${p}`;
}

async function graph(path: string, params: Record<string, string>) {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}?${new URLSearchParams(params)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Facebook error ${res.status}`);
  return data;
}

/** Exchanges the login code for long-lived Page tokens of every Page the user manages. */
export async function pagesFromCode(code: string, redirectUri: string) {
  const id = process.env.FB_APP_ID || "", secret = process.env.FB_APP_SECRET || "";
  const short = await graph("oauth/access_token", { client_id: id, client_secret: secret, redirect_uri: redirectUri, code });
  const long = await graph("oauth/access_token", { grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: short.access_token });
  const pages = await graph("me/accounts", { access_token: long.access_token, fields: "id,name,access_token", limit: "100" });
  return (pages.data ?? []).map((p: { id: string; name: string; access_token: string }) => ({ id: p.id, name: p.name, token: p.access_token }));
}
