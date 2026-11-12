# 醍醐 Web（share-web）

App「醍醐」的桌面 Web 版：三栏布局（参考微信 / 小红书 / Slack），黑白灰简约风格。

## 架构（网关试点）

浏览器 / 日后 App **只访问本站 Next.js `/api/*`**，由 EdgeOne（或本机）上的 Node **服务端**再访问 Supabase。  
用于解决国内客户端直连 `*.supabase.co` 失败、需开代理的问题。

| 路径 | 说明 |
| --- | --- |
| `GET /api/health` | 探活：网关 → Supabase 是否通 |
| `POST /api/auth/login` | 登录（Cookie + 返回 tokens 供 App Bearer） |
| `POST /api/auth/logout` | 退出 |
| `GET /api/auth/me` | 当前用户 |
| `GET /api/articles` | 市集文章列表 `?city=&ownerId=` |
| `GET /api/articles/[id]` | 文章详情 |

Web 端登录与文章列表/详情已走上述接口。评论/关注等仍有过渡期直连，后续继续迁到 `/api`。

## 功能

- **求索**：市集文章流、陋室、文章阅读与分享 `/a/{id}`
- **关注 / 醍醐 / 找 AI / 我的**：见界面

## 环境变量

复制 `.env.example` → `.env.local`：

| 变量 | 说明 |
| --- | --- |
| `SUPABASE_URL` | 服务端用（推荐） |
| `SUPABASE_ANON_KEY` | 服务端用 |
| `NEXT_PUBLIC_SITE_URL` | 本站根地址 |
| `NEXT_PUBLIC_APP_DOWNLOAD_URL` | 可选 |

未设 `SUPABASE_*` 时会回退 `NEXT_PUBLIC_SUPABASE_*`。

## 本地验证（无代理）

```bash
cd share-web
npm run dev
```

1. 打开 http://localhost:3000 — 求索应能出文章（经 `/api/articles`）
2. `curl http://localhost:3000/api/health` — `ok: true` 且 `supabase: true`
3. 登录走 `/api/auth/login`，Cookie 写入后 `/api/auth/me` 有用户

部署到 EdgeOne 后，在**不开代理**的网络再测一遍 `/api/health` 与首页，即可确认「国内可访问」。

## App 对接（下一步）

- Base URL：你的 EdgeOne 域名
- 登录：`POST /api/auth/login`，用返回的 `tokens.access_token` 作 `Authorization: Bearer …`
- 文章：`GET /api/articles`、`GET /api/articles/:id`（可带 Bearer）

## 部署

EdgeOne Makers / Vercel：Next.js，`npm install && npm run build`。  
环境变量在控制台配置 `SUPABASE_URL` / `SUPABASE_ANON_KEY`。
