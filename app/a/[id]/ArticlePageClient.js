"use client";

import { AuthProvider } from "../../../components/AuthProvider";
import AppShell from "../../../components/AppShell";

export default function ArticlePageClient({ articleId, initialArticle }) {
  return (
    <AuthProvider>
      <AppShell
        initialArticleId={articleId}
        initialArticle={initialArticle || null}
      />
    </AuthProvider>
  );
}
