import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NODE",
    short_name: "NODE",
    description: "NODE — a Burning Man theme camp built on art, music, and communal effort",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0F0120",
    theme_color: "#0F0120",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
