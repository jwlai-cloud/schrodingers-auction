import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const _inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const _jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Schrödinger's Auction — The falling-price drop platform",
  description:
    "A Dutch auction where the whole world is in the room. Watch the price fall in real time. Arm yourself. Claim before anyone else.",
  keywords: ["dutch auction", "live auction", "falling price", "drop"],
  openGraph: {
    title: "Schrödinger's Auction",
    description: "The falling-price drop platform where the whole world is in the room.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1016",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${_inter.variable} ${_jetbrains.variable} bg-background`}
    >
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
