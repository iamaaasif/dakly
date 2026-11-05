import { NextResponse } from "next/server";
import { shopOrNull } from "@/lib/auth";
import { aiEnabled, parseCustomerSpeech, transcribe } from "@/lib/ai";
import { withAi, AiLimitError } from "@/lib/usage";
import { tr } from "@/lib/i18n/server";

export async function POST(req: Request) {
  const shop = await shopOrNull();
  if (!shop) return NextResponse.json({ error: await tr("Login করুন") }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: await tr("Voice Input এখনো চালু হয়নি") }, { status: 400 });
  const audio = (await req.formData()).get("audio");
  if (!(audio instanceof File) || audio.size < 1000) return NextResponse.json({ error: await tr("কিছু শোনা যায়নি, আবার বলুন") }, { status: 400 });
  if (audio.size > 10 * 1024 * 1024) return NextResponse.json({ error: await tr("Recording অনেক বড়, ছোট করে বলুন") }, { status: 400 });
  try {
    const out = await withAi(shop, "voice", async () => {
      const text = await transcribe(audio, audio.name, shop.language);
      return { text, parsed: await parseCustomerSpeech(text, shop.country) };
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: await tr(e instanceof AiLimitError ? e.message : "বুঝতে পারিনি, আবার বলুন") }, { status: e instanceof AiLimitError ? 429 : 500 });
  }
}
