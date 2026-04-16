import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/login", "/profile"],
    },
    sitemap: "https://pokecomp.app/sitemap.xml",
  };
}
