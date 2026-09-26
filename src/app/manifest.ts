import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kerafresh",
    short_name: "Kerafresh",
    description: "Daily business transaction tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f0eb",
    theme_color: "#1baf7a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
