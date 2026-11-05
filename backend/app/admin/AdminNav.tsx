"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: [string, string][] }) {
  const path = usePathname();
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return <nav className="adm-nav" aria-label="Back office">{items.map(([h, l]) => <Link key={h} href={h} className={on(h) ? "on" : ""} aria-current={on(h) ? "page" : undefined}>{l}</Link>)}</nav>;
}
