import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/**
 * Only the public surface is indexable. Everything behind sign-in is a
 * customer's compliance record — it must never be crawled, and the API and
 * auth routes have nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/privacy", "/terms"],
      disallow: [
        "/api/",
        "/queue",
        "/documents",
        "/dashboard",
        "/submit",
        "/audit",
        "/rubric",
        "/users",
        "/thank-you",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
