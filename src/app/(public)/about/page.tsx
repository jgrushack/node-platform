import type { Metadata } from "next";
import AboutClient from "./about-client";

export const metadata: Metadata = {
  title: "History of NODE",
  description:
    "From a handful of colleagues in 2017 to a 501(c)(3) foundation. The story of NODE — a decentralized network of people building something together in the desert.",
};

export default function AboutPage() {
  return <AboutClient />;
}
