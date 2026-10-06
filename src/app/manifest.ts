import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collaktiv CRM",
    short_name: "CRM",
    description: "Partnerförsäljning för Collaktiv i Gävleborg",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#166849",
    lang: "sv",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
