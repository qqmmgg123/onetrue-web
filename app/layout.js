import "./globals.css";

export const metadata = {
  title: "醍醐",
  description: "笔记 · 市集 · 关注 — 黑白灰简约 Web",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
