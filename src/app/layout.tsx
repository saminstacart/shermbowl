import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ShermBowl PropBets",
  description: "Super Bowl LX Prop Bets — Patriots vs Seahawks. 21 props, real odds, live leaderboard. $50 buy-in, 60/30/10 payout.",
  metadataBase: new URL("https://shermbowl.vercel.app"),
  openGraph: {
    title: "Super Bowl LX Prop Bets",
    description: "21 props. Real sportsbook odds. Live scoring. $50 buy-in, 60/30/10 payout.",
    siteName: "ShermBowl",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Super Bowl LX Prop Bets",
    description: "21 props. Real sportsbook odds. Live scoring. $50 buy-in, 60/30/10 payout.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jakarta.variable} ${jetbrains.variable} antialiased bg-[#09090b] text-[#e4e4e7] min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
