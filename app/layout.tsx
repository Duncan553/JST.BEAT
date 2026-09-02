import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AudioPlayer } from "@/components/audio-player/AudioPlayer";
import { BottomNav } from "@/components/BottomNav";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL, absoluteUrl } from "@/lib/site";

// Two faces, two jobs (see .claude/skills/design/SKILL.md). Inter is unbeatable
// for UI at small sizes; it is also completely neutral, which is why a site set
// entirely in it reads as flat. Bricolage carries the headlines — ink traps and
// tight apertures give the display type a voice Inter doesn't have.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  // metadataBase is what turns a relative image path into the absolute URL
  // WhatsApp/Instagram/X require. Without it, link previews silently show
  // nothing at all — no artwork, no title, just a bare URL.
  metadataBase: new URL(SITE_URL),

  // `template` gives every page its own title while keeping the brand on the
  // end. A page sets `title: 'Album Reviews'` and gets
  // "Album Reviews — JST.BEAT". `default` covers pages that set none.
  title: {
    default: `${SITE_NAME} — Buy Beats Online in Kenya`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "buy beats", "beats for sale", "type beat", "Kenyan producer",
    "boom bap beats", "drumless beats", "alternative hip hop beats",
    "trap beats", "M-Pesa beats", "jst.dan", "tisco prodz",
  ],
  authors: [{ name: "jst.dan" }, { name: "tisco prodz" }],
  creator: SITE_NAME,
  alternates: { canonical: absoluteUrl("/") },

  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Buy Beats Online in Kenya`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    locale: "en_KE",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Buy Beats Online in Kenya`,
    description: SITE_DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${bricolage.variable} font-sans antialiased`}>
        <Header />
        <main id="main-content">{children}</main>
        <AudioPlayer />
        <BottomNav />
      </body>
    </html>
  );
}