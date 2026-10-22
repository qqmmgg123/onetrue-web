# 房间视频分享站（Vercel）

竖屏网页播放 Cloudflare R2 上的房间视频，底部展示月租（与 App 租约一致）。

## 环境变量（Vercel Project Settings）

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_R2_PUBLIC_BASE` | R2 公开访问前缀，如 `https://pub-xxx.r2.dev` |
| `NEXT_PUBLIC_APP_DOWNLOAD_URL` | App 下载页（可先空着） |
| `NEXT_PUBLIC_APP_DOWNLOAD_HINT` | 下载说明文案 |

## 部署

```bash
cd share-web
npm i
npx vercel
```

部署后把站点根地址填进 App 的 `supabase/env.local`：

```
SHARE_WEB_BASE=https://你的项目.vercel.app
R2_PUBLIC_BASE=https://pub-xxx.r2.dev
```

分享链接格式：`{SHARE_WEB_BASE}/r/{roomUuid}`
