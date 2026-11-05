import { prepareCallAudio, type CallPart } from "@/lib/voice-audio";

// Asterisk fetches /api/voice/audio/<message id>/<main|bye|thanks>.sln24 during a call.
// The extension tells Asterisk the format (raw 24 kHz 16-bit). The id is an unguessable message id.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const m = /^(main|bye|thanks)\.sln24$/.exec(file);
  const audio = m ? await prepareCallAudio(id, m[1] as CallPart, "sln24") : null;
  if (!audio) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, max-age=600" } });
}
