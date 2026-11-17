import { notFound } from "next/navigation";
import {
  fetchArticleByIdServer,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../lib/server/supabase";
import { displayTitle, excerpt, plainTextFromBody } from "../../../lib/format";
import { articleSharePath, siteOrigin } from "../../../lib/site";
import ArticlePageClient from "./ArticlePageClient";

/** EdgeOne Makers / Node：ISR，兼顾 SEO 与新鲜度 */
export const revalidate = 120;
export const runtime = "nodejs";

async function loadArticle(id) {
  if (!id || !hasServerSupabase()) return null;
  try {
    return await fetchArticleByIdServer(id);
  } catch (_) {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const id = params?.id || "";
  const origin = siteOrigin();
  const article = await loadArticle(id);
  const title = article
    ? `${displayTitle(article.title, article.body, "文章", article.format)} · 醍醐`
    : "文章 · 醍醐";
  const description = article
    ? excerpt(article.body, 120) || "在醍醐阅读这篇文章"
    : "在醍醐阅读这篇文章";
  const url = origin ? `${origin}${articleSharePath(id)}` : undefined;
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "醍醐",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ArticleSharePage({ params }) {
  const id = params?.id || "";
  if (!id) notFound();

  const article = await loadArticle(id);
  if (!article) notFound();

  let authorName = "";
  try {
    if (article.ownerId) {
      const p = await fetchProfileServer(article.ownerId);
      authorName = p?.displayName || "";
    }
  } catch (_) {}

  const title = displayTitle(
    article.title,
    article.body,
    "无标题文章",
    article.format,
  );
  const plain = plainTextFromBody(article.body, article.format)
    .replace(/\s+/g, " ")
    .trim();
  const origin = siteOrigin();
  const url = origin ? `${origin}${articleSharePath(id)}` : articleSharePath(id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: excerpt(article.body, 160),
    datePublished: article.listedAt || undefined,
    author: authorName
      ? { "@type": "Person", name: authorName }
      : undefined,
    mainEntityOfPage: url,
    isPartOf: { "@type": "WebSite", name: "醍醐", url: origin || undefined },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 爬虫可读正文；有 JS 时由 AppShell 覆盖全屏 */}
      <article className="seo-crawl">
        <h1>{title}</h1>
        {authorName ? <p className="seo-author">{authorName}</p> : null}
        <div className="seo-body">{plain.slice(0, 8000)}</div>
      </article>
      <ArticlePageClient articleId={id} initialArticle={article} />
    </>
  );
}
