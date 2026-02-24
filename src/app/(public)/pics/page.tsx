import type { Metadata } from "next";
import PicsClient from "./pics-client";

export const metadata: Metadata = {
  title: "Pics",
  description: "Moments from the playa, preserved in pixels. A gallery of NODE memories.",
};

export default function PicsPage() {
  return <PicsClient />;
}
