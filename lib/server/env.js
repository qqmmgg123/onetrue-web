/** 服务端环境（勿用 NEXT_PUBLIC_ 暴露 service role） */

export function supabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

export function supabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
}

/** 可选：有则服务端写操作用它；试点读写 listed 文章用 anon 即可 */
export function supabaseServiceKey() {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function hasServerSupabase() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
