import { siteOrigin } from "../lib/site";

export default function robots() {
  const origin = siteOrigin() || "https://otrue.top";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/a/"],
      disallow: ["/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
