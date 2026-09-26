import type { Metadata } from "next";
import { TypographyStudio } from "@/components/typography-studio";

export const metadata: Metadata = {
  title: "Typography — Only Burn Through",
  description: "Distressed red stencil lettering with animated erasure, scratches, and signal distortion.",
};

export default function TypographyPage() {
  return <TypographyStudio />;
}
