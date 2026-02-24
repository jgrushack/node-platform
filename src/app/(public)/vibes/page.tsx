import type { Metadata } from "next";
import VibesClient from "./vibes-client";

export const metadata: Metadata = {
  title: "Vibes",
  description:
    "The energy, the principles, and the ethos behind NODE. Music curation, communal effort, and a zero-tolerance vibe check.",
};

export default function VibesPage() {
  return <VibesClient />;
}
