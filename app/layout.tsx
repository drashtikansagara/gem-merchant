import { Cinzel, Playfair_Display, Source_Sans_3 } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import { GAME_CONFIG } from "@/lib/config";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-cinzel",
});

const numeral = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-playfair",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source",
});

export const metadata: Metadata = {
  title: GAME_CONFIG.name,
  description: GAME_CONFIG.tagline,
};

/** Applies the saved theme before first paint, so Privacy never flashes bright. */
const THEME_INIT = `try{var d=document.documentElement,s=localStorage;d.dataset.theme=s.getItem("gm-theme")||"charcoal";d.dataset.privacy=s.getItem("gm-privacy")||"2"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${numeral.variable} ${sans.variable} h-full antialiased`}
      data-theme="charcoal"
      // The pre-paint script may change data-theme before React hydrates.
      suppressHydrationWarning
    >
      <body className="min-h-full bg-table font-sans text-ink">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT}
        </Script>
        <AppProviders>{children}</AppProviders>
        <div aria-hidden="true" className="privacy-glass" />
      </body>
    </html>
  );
}
