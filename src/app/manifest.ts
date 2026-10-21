import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Food Tracker",
    short_name: "Food Tracker",
    description: "Log where you ate, keep recommendations, and find places to try nearby.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ea580c",
    // TODO(Phase 1): add 192px and 512px PNG icons under public/icons so the app is installable.
    icons: [],
  };
}
