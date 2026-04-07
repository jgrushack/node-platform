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
    default: "NODE",
    template: "%s | NODE",
  },
  description:
    "NODE is a Burning Man theme camp and 501(c)(3) built on art, music, and communal effort. We're a node in the network — the point where individuals connect to something larger.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://node.family"
  ),
  openGraph: {
    title: "NODE 2026",
    description:
      "Art, music, and communal effort on the playa. The point where you connect to something larger.",
    siteName: "NODE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NODE 2026",
    description:
      "Art, music, and communal effort on the playa. The point where you connect to something larger.",
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
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NODE" />
        <meta name="theme-color" content="#0F0120" />
      </head>
      <body
        className={`${exo2.variable} ${neuropol.variable} ${sciFied.variable} antialiased overscroll-none`}
      >
        <TooltipProvider>
          <GradientMesh />
          {children}
          <footer className="py-6 text-center text-xs text-sand-500">
            &copy; NODE 2026
          </footer>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
