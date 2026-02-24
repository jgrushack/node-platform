import type { Metadata } from "next";
import { Exo_2 } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GradientMesh } from "@/components/background/gradient-mesh";
import "./globals.css";

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
});

const neuropol = localFont({
  src: "../../public/fonts/Neuropol.otf",
  variable: "--font-neuropol",
  display: "swap",
});

const sciFied = localFont({
  src: [
    {
      path: "../../public/fonts/SciFied.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/SciFied-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-scified",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NODE | The Collective",
    template: "%s | NODE",
  },
  description:
    "NODE is a community of creators, builders, and dreamers. Born in the desert. Built for the future.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://node.family"
  ),
  openGraph: {
    title: "NODE | The Collective",
    description:
      "A collective of creators, builders, and dreamers. Born in the desert. Built for the future.",
    siteName: "NODE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NODE | The Collective",
    description:
      "A collective of creators, builders, and dreamers. Born in the desert. Built for the future.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overscroll-none">
      <body
        className={`${exo2.variable} ${neuropol.variable} ${sciFied.variable} antialiased overscroll-none`}
      >
        <TooltipProvider>
          <GradientMesh />
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
