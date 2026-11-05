"use client";
import { createContext, useContext, useMemo } from "react";
import { makeLoc, type FmtOpts, type Loc } from "@/lib/i18n";

const Ctx = createContext<Loc | null>(null);

export function I18nProvider({ opts, children }: { opts: FmtOpts; children: React.ReactNode }) {
  const loc = useMemo(() => makeLoc(opts), [opts.lang, opts.currency, opts.tz, opts.country]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={loc}>{children}</Ctx.Provider>;
}

export function useLoc(): Loc {
  const v = useContext(Ctx);
  if (!v) return makeLoc({ lang: "bn", currency: "BDT", tz: "Asia/Dhaka", country: "BD" });
  return v;
}
