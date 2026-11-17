import { fetchListedArticlesServer, hasServerSupabase } from "../lib/server/supabase";
import { articleSharePath, siteOrigin } from "../lib/site";

export const revalidate = 300;

export default async function sitemap() {
  const origin = siteOrigin() || "https://otrue.top";
  const entries = [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
  if (!hasServerSupabase()) return entries;
  try {
    const articles = await fetchListedArticlesServer();
    for (const a of articles.slice(0, 500)) {
      if (!a?.id) continue;
      entries.push({
        url: `${origin}${articleSharePath(a.id)}`,
        lastModified: a.listedAt ? new Date(a.listedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (_) {}
  return entries;
}
