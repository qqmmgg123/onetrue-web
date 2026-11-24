import { NextResponse } from "next/server";
import { readAccessToken } from "../../../../lib/server/session";
import {
  authGetUser,
  fetchProfileServer,
  hasServerSupabase,
} from "../../../../lib/server/supabase";
import { restGet, restPatch, restPost } from "../../../../lib/server/rest";
import { resolveNoteTitleForSave } from "../../../../lib/format";
import {
  NOTE_SELECT,
  mapNote,
  recurFieldsFromBody,
} from "../../../../lib/server/note-map";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireUser(request) {
  if (!hasServerSupabase()) {
    return { error: NextResponse.json({ error: "未配置" }, { status: 503 }) };
  }
  const token = readAccessToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: "请先登录" }, { status: 401 }) };
  }
  const user = await authGetUser(token);
  if (!user?.id) {
    return { error: NextResponse.json({ error: "登录失效" }, { status: 401 }) };
  }
  return { token, user };
}

/** 更新已有笔记（与 App saveNote 对齐的核心字段） */
export async function PATCH(request, { params }) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  const id = String(params?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    const existing = await restGet(
      `/notes?select=${NOTE_SELECT}&id=eq.${encodeURIComponent(id)}&owner_id=eq.${user.id}&deleted_at=is.null&limit=1`,
      { accessToken: token },
    );
    const cur = Array.isArray(existing) ? existing[0] : null;
    if (!cur) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const patch = { updated_at: now };

    if (body.body != null) patch.body = String(body.body);
    if (body.format != null) patch.format = String(body.format);
    if (body.kind != null) patch.kind = String(body.kind).trim() || cur.kind;
    if (body.city != null) patch.city = String(body.city).trim();
    if (body.coverUrl != null || body.cover_url != null) {
      patch.cover_url = String(body.coverUrl ?? body.cover_url ?? "").trim();
    }
    if (body.sortOrder != null || body.sort_order != null) {
      const so = Number(body.sortOrder ?? body.sort_order);
      if (Number.isFinite(so)) patch.sort_order = Math.trunc(so);
    }
    if (body.pinnedAt !== undefined || body.pinned_at !== undefined) {
      const raw = body.pinnedAt ?? body.pinned_at;
      if (raw === null || raw === "") patch.pinned_at = null;
      else {
        const d = new Date(raw);
        patch.pinned_at = Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
    }
    if (body.completedAt !== undefined || body.completed_at !== undefined) {
      const raw = body.completedAt ?? body.completed_at;
      if (raw === null || raw === "") patch.completed_at = null;
      else {
        const d = new Date(raw);
        patch.completed_at = Number.isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    const nextKind = patch.kind || cur.kind;
    if (nextKind === "admonition" || cur.kind === "admonition") {
      const profile = await fetchProfileServer(user.id, token);
      if (!profile?.isAdmin) {
        return NextResponse.json(
          { error: "仅管理员可推荐谏言" },
          { status: 403 },
        );
      }
    }
    const nextBody = patch.body != null ? patch.body : cur.body;
    const nextFormat = patch.format || cur.format || "quill";
    // 与 App 一致：笔记/备忘空标题用正文截取
    if (body.title != null || body.body != null || body.kind != null) {
      const rawTitle =
        body.title != null ? body.title : cur.title || "";
      if (
        (nextKind === "schedule" || nextKind === "article") &&
        !String(rawTitle || "").trim()
      ) {
        return NextResponse.json(
          {
            error:
              nextKind === "schedule" ? "日常必须填写标题" : "文章必须填写标题",
          },
          { status: 400 },
        );
      }
      patch.title = resolveNoteTitleForSave({
        kind: nextKind,
        title: rawTitle,
        body: nextBody,
        format: nextFormat,
      });
    }

    if (body.scheduleAt !== undefined) {
      patch.schedule_at = body.scheduleAt
        ? new Date(body.scheduleAt).toISOString()
        : null;
    }
    if (body.remindAt !== undefined) {
      patch.remind_at = body.remindAt
        ? new Date(body.remindAt).toISOString()
        : null;
    }

    const recurTouched =
      body.recurFreq != null ||
      body.recur_freq != null ||
      body.recurByday != null ||
      body.recurUntil != null ||
      body.recurCount != null ||
      body.remindOffsetMin != null ||
      body.remind_offset_min != null ||
      body.kind != null;

    if (recurTouched || nextKind !== "schedule") {
      const recur = recurFieldsFromBody(
        {
          ...body,
          recurFreq: body.recurFreq ?? body.recur_freq ?? cur.recur_freq,
          recurInterval:
            body.recurInterval ?? body.recur_interval ?? cur.recur_interval,
          recurByday: body.recurByday ?? body.recur_byday ?? cur.recur_byday,
          recurUntil: body.recurUntil ?? body.recur_until ?? cur.recur_until,
          recurCount: body.recurCount ?? body.recur_count ?? cur.recur_count,
          remindOffsetMin:
            body.remindOffsetMin ??
            body.remind_offset_min ??
            cur.remind_offset_min,
        },
        { kind: nextKind },
      );
      Object.assign(patch, recur);
    }

    if (nextKind === "schedule") {
      const scheduleAt =
        patch.schedule_at !== undefined
          ? patch.schedule_at
          : cur.schedule_at;
      const offset =
        patch.remind_offset_min != null
          ? patch.remind_offset_min
          : cur.remind_offset_min ?? 0;
      if (!scheduleAt) {
        patch.schedule_at = now;
      }
      const sched = patch.schedule_at || scheduleAt || now;
      if (offset < 0) {
        patch.remind_at = null;
      } else if (body.remindAt === undefined) {
        patch.remind_at = new Date(
          new Date(sched).getTime() - offset * 60000,
        ).toISOString();
      }
    } else if (nextKind === "memo") {
      patch.schedule_at = null;
      if (body.noRemind === true || body.remindOffsetMin === -1) {
        patch.remind_at = null;
      }
    } else {
      patch.schedule_at = null;
      patch.remind_at = null;
    }

    let listingStatus = cur.listing_status || "draft";
    if (body.listingStatus === "listed" || body.list === true) {
      listingStatus = "listed";
    } else if (body.listingStatus === "draft" || body.list === false) {
      listingStatus = "draft";
    }
    if (nextKind === "admonition") {
      listingStatus = "listed";
    } else if (nextKind !== "article") {
      listingStatus = "draft";
      patch.cover_url = "";
    }
    patch.listing_status = listingStatus;
    if (listingStatus === "listed" && !cur.listed_at) {
      patch.listed_at = now;
    } else if (listingStatus !== "listed") {
      patch.listed_at = null;
    }

    if (
      (patch.title != null && !patch.title) ||
      (patch.title === undefined && !(cur.title || "").trim())
    ) {
      const kind = nextKind;
      patch.title =
        kind === "article"
          ? "无标题文章"
          : kind === "memo"
            ? "备忘"
            : kind === "schedule"
              ? "日程"
              : "随笔";
    }

    const text = patch.body != null ? patch.body : cur.body || "";
    const title = patch.title != null ? patch.title : cur.title || "";
    const plainProbe = String(text).trim();
    const looksEmpty =
      !plainProbe ||
      plainProbe === '[{"insert":"\\n"}]' ||
      plainProbe === '[{"insert":"\n"}]';
    if (looksEmpty && !String(title).trim()) {
      return NextResponse.json({ error: "请填写标题或正文" }, { status: 400 });
    }

    const rows = await restPatch(
      `/notes?id=eq.${encodeURIComponent(id)}&owner_id=eq.${user.id}`,
      patch,
      { accessToken: token },
    );
    const saved = Array.isArray(rows) ? rows[0] : rows;

    if (listingStatus === "listed") {
      try {
        await restPost(
          "/note_stats?on_conflict=note_id",
          {
            note_id: id,
            view_count: 0,
            recommend_count: 0,
            comment_count: 0,
          },
          {
            accessToken: token,
            prefer: "resolution=merge-duplicates,return=minimal",
          },
        );
      } catch (_) {}
    }

    return NextResponse.json({ note: mapNote(saved || { ...cur, ...patch }) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function GET(request, { params }) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  const id = String(params?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  try {
    const rows = await restGet(
      `/notes?select=${NOTE_SELECT}&id=eq.${encodeURIComponent(id)}&owner_id=eq.${user.id}&deleted_at=is.null&limit=1`,
      { accessToken: token },
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    return NextResponse.json({ note: mapNote(row) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

/** 软删除 */
export async function DELETE(request, { params }) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { token, user } = auth;
  const id = String(params?.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }
  try {
    const now = new Date().toISOString();
    const rows = await restPatch(
      `/notes?id=eq.${encodeURIComponent(id)}&owner_id=eq.${user.id}&deleted_at=is.null`,
      { deleted_at: now, updated_at: now },
      { accessToken: token },
    );
    const saved = Array.isArray(rows) ? rows[0] : rows;
    if (!saved) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, note: mapNote(saved) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
