import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShermBowl PropBets",
  description: "21 props. Real sportsbook odds. Live scoring. $50 buy-in, 60/30/10 payout.",
  openGraph: {
    title: "Make Your Picks Before Kickoff",
    description: "21 props. Real sportsbook odds. Live scoring. $50 buy-in, 60/30/10 payout.",
    siteName: "ShermBowl",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Make Your Picks Before Kickoff",
    description: "21 props. Real sportsbook odds. Live scoring. $50 buy-in, 60/30/10 payout.",
  },
};

export default function JoinPage() {
  redirect("/");
}
