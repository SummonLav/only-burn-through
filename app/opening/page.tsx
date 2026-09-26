import type { Metadata } from "next";
import { OpeningStudio } from "@/components/opening-studio";

export const metadata: Metadata = {
  title: "Burn-through intro — Only Burn Through",
  description: "A distressed red title burns away in rising flames to reveal a gold portrait.",
};

export default function OpeningPage() {
  return <OpeningStudio />;
}
