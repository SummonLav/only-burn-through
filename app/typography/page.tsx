import type { Metadata } from "next";
import { TypographyStudio } from "@/components/typography-studio";

export const metadata: Metadata = {
  title: "字体效果 — The Weeknd Concert Transition",
  description: "红色模板字幕、动态擦除、黑白磨损与模拟电视信号。",
};

export default function TypographyPage() {
  return <TypographyStudio />;
}
