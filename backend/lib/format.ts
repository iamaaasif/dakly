const BN = "০১২৩৪৫৬৭৮৯";
export const bn = (s: string | number) => String(s).replace(/\d/g, (d) => BN[Number(d)]);
export const tk = (n: number) => "৳" + bn(Math.round(n).toLocaleString("en-IN"));

const EN: Record<string, string> = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };
export const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => EN[d]);

/** Normalises a Bangladeshi mobile number to 8801XXXXXXXXX. Returns null if it does not look valid. */
export function normalizePhone(raw: string): string | null {
  let p = toAsciiDigits(String(raw)).replace(/[^\d]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("880")) p = p.slice(3);
  if (p.startsWith("0")) p = p.slice(1);
  if (/^1[3-9]\d{8}$/.test(p)) return "880" + p;
  return null;
}

export const displayPhone = (p: string) => {
  const local = p.startsWith("880") ? "0" + p.slice(3) : p;
  return bn(local.length === 11 ? local.slice(0, 5) + "-" + local.slice(5) : local);
};

export function ago(d: Date | null | undefined): string {
  if (!d) return "কখনো না";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "আজ";
  if (days === 1) return "গতকাল";
  if (days < 7) return `${bn(days)} দিন আগে`;
  if (days < 30) return `${bn(Math.floor(days / 7))} সপ্তাহ আগে`;
  return `${bn(days)} দিন আগে`;
}

export function dateTimeBn(d: Date) {
  const opts: Intl.DateTimeFormatOptions = { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true };
  return bn(new Intl.DateTimeFormat("en-GB", opts).format(d));
}
