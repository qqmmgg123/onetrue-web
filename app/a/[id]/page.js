import { AuthProvider } from "../../../components/AuthProvider";
import AppShell from "../../../components/AppShell";
import { siteOrigin } from "../../../lib/site";

export async function generateMetadata({ params }) {
  const id = params?.id || "";
  const origin = siteOrigin();
  return {
    title: "文章 · 醍醐",
    description: "在醍醐阅读这篇上架文章",
    openGraph: {
      title: "文章 · 醍醐",
      description: "笔记市集 · 黑白灰简约",
      url: origin ? `${origin}/a/${id}` : undefined,
      type: "article",
    },
  };
}

export default function ArticleSharePage({ params }) {
  const id = params?.id || "";
  return (
    <AuthProvider>
      <AppShell initialArticleId={id} />
    </AuthProvider>
  );
}
