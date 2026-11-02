# 房间视频分享站（EdgeOne Makers）

竖屏网页播放七牛/R2 上的房间视频，底部展示月租。面向国内访问与微信打开。

> 原 Vercel 部署可继续用，但国内/微信常不可达；推荐迁到腾讯云 **EdgeOne Makers** 免费版。

## 环境变量（EdgeOne 项目设置）

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_QINIU_PUBLIC_BASE` | **推荐** 七牛公开前缀，如 `http://xxx.clouddn.com` |
| `NEXT_PUBLIC_R2_PUBLIC_BASE` | R2 公开前缀（备用） |
| `NEXT_PUBLIC_SHARE_WEB_BASE` | 本站根地址（OG 规范链接），与 EdgeOne 域名一致 |
| `NEXT_PUBLIC_APP_DOWNLOAD_URL` | App 下载页（可空） |
| `NEXT_PUBLIC_APP_DOWNLOAD_HINT` | 下载说明文案 |

`meta.json` 里已有完整 `videoUrl` / `posterUrl` 时，页面会优先用其中的绝对地址。

## 部署到 EdgeOne Makers（免费）

1. 打开 [EdgeOne Makers](https://pages.edgeone.ai/) / 腾讯云控制台，用微信或腾讯云账号开通 **免费版**。
2. 新建项目 → 导入本仓库的 `share-web` 目录（或单独拆仓库），框架选 **Next.js**。
3. 构建命令：`npm install && npm run build`；输出按 Next 默认（非纯静态，保留 SSR/`opengraph-image`）。
4. 在项目环境变量里填上表各项，保存后 **重新部署**。
5. 得到站点域名后，写入 App 的 `supabase/env.local`：

```
SHARE_WEB_BASE=https://你的edgeone域名
```

然后重新 `.\build_apk.ps1 -Install`。

自定义已备案域名可在 Makers「域名管理」绑定，微信内打开更稳。

## App 微信卡片分享

系统「分享文本链接」在微信里经常没有图文卡。App 已接 **微信开放平台 SDK（fluwx）**：

1. 到 [微信开放平台](https://open.weixin.qq.com) 创建 **移动应用**。
2. Android：包名 `com.local.rent.rent_agent`，签名为 **release 所用 keystore 的 MD5**（当前 release 若仍是 debug 签名，填 debug 的 MD5；以后换正式签名要改后台）。
3. 把 AppID 写入 `supabase/env.local`：

```
WECHAT_APP_ID=wx你的AppId
# iOS 再填通用链接
WECHAT_UNIVERSAL_LINK=
```

4. 重新打包。视频页点「分享网页」→ **微信好友 / 朋友圈**，会传入标题、描述、封面缩略图。

审核通过前，分享仅对开放平台配置的体验账号可见。

## 分享卡片（网页 OG）

每个 `/r/{id}` 仍会生成 `og:title` / `og:description` / 封面图，供浏览器或其它 App 抓取。  
**微信会话里的正式卡片**以开放平台 SDK 传入的 Title / Description / Thumbnail 为准。

## 本地开发

```bash
cd share-web
npm i
# 复制 .env.example → .env.local 并填写
npm run dev
```

分享链接格式：`{SHARE_WEB_BASE}/r/{roomUuid}`
