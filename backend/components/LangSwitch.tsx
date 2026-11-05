"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_KEYS } from "@/lib/i18n";
import { setLanguage } from "@/app/actions";
import { useLoc } from "./I18n";

/** Panel language toggle. Saved on the account and in a cookie (for the login pages). */
export function LangSwitch({ className = "icon-btn" }: { className?: string }) {
  const { lang } = useLoc();
  const router = useRouter();
  const [busy, start] = useTransition();
  const next = LANG_KEYS[(LANG_KEYS.indexOf(lang) + 1) % LANG_KEYS.length];
  return (
    <button type="button" className={className} disabled={busy} aria-label={`Language: ${LANGS[next].name}`} title={LANGS[next].name}
      onClick={() => start(async () => { await setLanguage(next); router.refresh(); })} style={{ fontWeight: 700, fontSize: 13, width: "auto", padding: "0 10px" }}>
      {next === "bn" ? "বাং" : next.toUpperCase()}
    </button>
  );
}
