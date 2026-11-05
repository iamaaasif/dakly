import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLoc } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/I18n";

export const metadata: Metadata = {
  title: "Dakly",
  description: "Bring your customers back. AI-powered customer growth platform.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Dakly", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fdfdfd" }, { media: "(prefers-color-scheme: dark)", color: "#070707" }], width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { opts } = await getLoc();
  return (
    <html lang={opts.lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Anek+Bangla:wght@500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <I18nProvider opts={opts}>{children}</I18nProvider>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }} />
      </body>
    </html>
  );
}
