/** Multipart "audio" (webm/mp4/m4a/ogg, under 10 MB). Returns { text, parsed: { name, phone, items, amount } }. */
export { POST } from "@/app/api/voice/transcribe/route";
