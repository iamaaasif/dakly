// AI voice calls over the SIP trunk: Dakly -> its Asterisk -> fake IPCallBD (test/asterisk/fake-ipcallbd.sh).
// Run with: sh test/voice-sip.sh
import fs from "node:fs";
import { t, section, eq, ok, get, post, mock, mockLog, sql, cron, newShop, until, sleep, results, BASE } from "./lib.mjs";

const REC = new URL("./results/voice-rec/", import.meta.url);
/** Loudness (RMS) of a recording from the fake carrier: 16-bit PCM WAV after the 44-byte header. */
function rms(file) {
  const b = fs.readFileSync(new URL(file, REC));
  let sum = 0, n = 0;
  for (let i = 44; i + 1 < b.length; i += 2) { const v = b.readInt16LE(i); sum += v * v; n++; }
  return n ? Math.sqrt(sum / n) : 0;
}
const byPhone = (campaignId) => Object.fromEntries(sql(`SELECT c.phone, m.status, coalesce(m.error,''), coalesce(m."providerId",'') FROM "CampaignMessage" m JOIN "Customer" c ON c.id=m."customerId" WHERE m."campaignId"='${campaignId}'`).split("\n").filter(Boolean).map((l) => { const [p, s, e, pid] = l.split("|"); return [p, { status: s, error: e, providerId: pid }]; }));

section("AI voice calls through Asterisk and the SIP trunk");
const S = await newShop();
sql(`UPDATE "Shop" SET plan='growth', "planUntil"=now()+interval '30 days' WHERE id='${S.shopId}'`);
const people = [["Press One", "01700000001"], ["Silent Listener", "01700000002"], ["Busy Line", "01700000003"], ["No Answer", "01700000004"], ["Abroad Person", "+14155550123"]];
for (const [name, phone] of people) {
  const r = await post("/api/v1/customers", { name, phone }, { token: S.token });
  if (r.status !== 201) throw new Error("customer " + JSON.stringify(r.json));
}
await mock("/__reset", {});
let camp;

await t("V1", "Voice campaign: Bangladesh numbers go to Asterisk, the US number goes to Twilio", async () => {
  const r = await post("/api/v1/campaigns", { segment: "all", message: "আসসালামু আলাইকুম {নাম}, নতুন Offer! আগ্রহী হলে ১ চাপুন।", channels: ["voice"] }, { token: S.token });
  eq(r.status, 201, JSON.stringify(r.json));
  camp = r.json.id;
  await until(async () => (await mockLog("api.twilio.com")).length > 0, 20000);
  const tw = await mockLog("api.twilio.com");
  eq(tw.length, 1, "only one call through Twilio");
  eq(tw[0].body.To, "+14155550123");
});

await t("V2", "Calls wait for a free line (SIP_MAX_CALLS=2) and every call reaches a final state", async () => {
  const final = new Set(["interested", "delivered", "failed"]);
  let seen = 0;
  await until(async () => {
    await cron();
    const m = byPhone(camp);
    const sip = Object.entries(m).filter(([p]) => p.startsWith("880"));
    seen = Math.max(seen, sip.filter(([, v]) => v.status === "sent").length);
    return sip.length === 4 && sip.every(([, v]) => final.has(v.status));
  }, 120000);
  ok(seen <= 2, `at most 2 calls at once, saw ${seen}`);
});

await t("V3", "Pressing 1 marks interested; listening without a key is delivered", async () => {
  const m = byPhone(camp);
  eq(m["8801700000001"].status, "interested", JSON.stringify(m));
  eq(m["8801700000002"].status, "delivered", JSON.stringify(m));
  ok(m["8801700000001"].providerId.startsWith("sip:"), m["8801700000001"].providerId);
  const d = await get(`/api/v1/campaigns/${camp}`, { token: S.token });
  eq(d.json.summary.interested, 1);
});

await t("V4", "Busy and unanswered calls fail with a clear reason", async () => {
  const m = byPhone(camp);
  eq([m["8801700000003"].status, m["8801700000003"].error], ["failed", "Call busy"]);
  eq([m["8801700000004"].status, m["8801700000004"].error], ["failed", "Call no-answer"]);
});

await t("V5", "The customer heard the speech: the carrier's recording is not silent", async () => {
  for (const n of ["8801700000001", "8801700000002"]) {
    // The recording is finished when the call has ended and the file stops growing
    let last = -1;
    await until(async () => {
      const size = fs.existsSync(new URL(n + ".wav", REC)) ? fs.statSync(new URL(n + ".wav", REC)).size : 0;
      const done = size > 8000 && size === last;
      last = size;
      await sleep(1500);
      return done;
    }, 40000);
    const level = rms(n + ".wav");
    ok(level > 500, `${n} recording RMS ${level.toFixed(0)}`);
  }
});

await t("V6", "Speech is made once per part as raw 24 kHz PCM for Asterisk", async () => {
  const tts = (await mockLog("api.openai.com")).filter((e) => e.path === "/v1/audio/speech");
  ok(tts.length > 0, "TTS called");
  const pcm = tts.filter((e) => e.body.response_format === "pcm");
  ok(pcm.some((e) => e.body.input.startsWith("আসসালামু আলাইকুম Press")), pcm.map((e) => e.body.input).join(" | "));
  // main for 4 answered-or-dialled calls (made before dialling), thanks for 1, bye for 1
  const main = pcm.filter((e) => e.body.input.startsWith("আসসালামু")).length;
  eq(main, 4, "one main speech per SIP call");
});

await t("V7", "Asterisk callbacks need Dakly's signature; audio needs a real voice message", async () => {
  const id = sql(`SELECT m.id FROM "CampaignMessage" m JOIN "Customer" c ON c.id=m."customerId" WHERE m."campaignId"='${camp}' AND c.phone='8801700000002'`);
  eq((await fetch(`${BASE}/api/webhooks/asterisk?m=${id}&sig=00&event=digit&digit=1`)).status, 403);
  eq((await fetch(`${BASE}/api/webhooks/asterisk?m=${id}&event=digit&digit=1`)).status, 403);
  eq(byPhone(camp)["8801700000002"].status, "delivered");
  eq((await fetch(`${BASE}/api/voice/audio/${id}/main.sln24`)).status, 200);
  eq((await fetch(`${BASE}/api/voice/audio/${id}/other.sln24`)).status, 404);
  eq((await fetch(`${BASE}/api/voice/audio/nope12345/main.sln24`)).status, 404);
});

fs.writeFileSync(new URL("./results/voice-results.json", import.meta.url), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await sleep(10);
process.exit(failed.length ? 1 : 0);
