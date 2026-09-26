import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";

export const metadata: Metadata = {
  title: "Only Burn Through",
  description: "Flame transitions, distressed typography, and burn-through intros. A small, playful tool in the Only series.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
