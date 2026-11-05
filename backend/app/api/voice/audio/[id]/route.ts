import { prepareCallAudio } from "@/lib/voice-audio";

// Twilio fetches this during a call. The id is an unguessable message id.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = new URL(req.url).searchParams.get("part");
  const audio = await prepareCallAudio(id, p === "bye" || p === "thanks" ? p : "main", "mp3");
  if (!audio) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=600" } });
}
