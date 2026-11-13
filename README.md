# 醍醐 Web + API 网关

## 架构

```
App / 浏览器  →  EdgeOne(share-web)  →  Supabase
```

- **Web**：业务走 `/api/auth`、`/api/articles`、`/api/notes`、`/api/social/*`、`/api/ai/chat`、`/api/profile`
- **App**：`SUPABASE_URL` bake 为 `{SHARE_WEB_BASE}/api/sb`，由 `/api/sb/*` 反代到真实 Supabase（Auth / Rest / Functions）

## 探活

`GET /api/health` → `ok: true` 表示网关能访问 Supabase。

## 本地

```bash
cd share-web
# 配置 .env.local
npm run dev
# 可选：对比直连 vs 经网关
# node --env-file=.env.local scripts/check-upstream.mjs
```

国内本机常无法直连 `*.supabase.co`，此时 `/api/health`、`/api/articles` 会 **502**（属网络问题，不是页面坏了）。

本机开发可把 `.env.local` 的 `SUPABASE_URL` 设为已部署网关：

```
SUPABASE_URL=http://otrue.top/api/sb
```

改完后需重启 `pnpm dev`。**EdgeOne 线上环境必须用真实 Supabase URL**，不能填自己的 `/api/sb`（会环）。

## App 打包

`supabase/env.local` 中：

```
SUPABASE_URL=http://otrue.top/api/sb
SUPABASE_ANON_KEY=（anon）
SHARE_WEB_BASE=http://otrue.top
```

然后 `.\build_apk.ps1`。国内无需再为 Supabase 开代理。

## Web 能力

- 求索 / 关注 / 醍醐 / 找 AI / 我的
- **写笔记**（可上架市集）
- **上传头像**（七牛，需配 QINIU_*）
- AI 经 `/api/ai/chat`（不再依赖浏览器里的 NEXT_PUBLIC_SUPABASE_*）
