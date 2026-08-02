import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { AudioPlayer } from "@/components/audio-player/AudioPlayer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JST.BEAT — Buy Beats Online",
  description: "Premium beats for artists and producers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-stone-950 text-stone-100 min-h-screen`}>
        <Header />
        <main className="max-w-6xl mx-auto p-6 pb-32">{children}</main>
        <AudioPlayer />
      </body>
    </html>
  );
}
