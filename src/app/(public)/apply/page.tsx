import type { Metadata } from "next";
import ApplyClient from "./apply-client";

export const metadata: Metadata = {
  title: "Apply to NODE",
  description:
    "Apply to join NODE — a Burning Man theme camp built on art, music, and doing the work together.",
};

export const maxDuration = 60;

export default function ApplyPage() {
  return <ApplyClient />;
}
