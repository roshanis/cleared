import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** The public pages only — the signed-in app is deliberately absent. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/login", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
  ];
  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${site.url}${path}`,
    changeFrequency,
    priority,
  }));
}
