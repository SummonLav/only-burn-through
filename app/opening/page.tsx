import type { Metadata } from "next";
import { OpeningStudio } from "@/components/opening-studio";

export const metadata: Metadata = {
  title: "字焰开场 — The Weeknd Concert Transition",
  description: "Singapore weekend 红色磨损标题被火焰从下向上烧散，过渡到熔金人像。",
};

export default function OpeningPage() {
  return <OpeningStudio />;
}
