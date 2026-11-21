/** 把后端 / Auth 英文错误转成对用户可读的中文。 */
export function userFacingError(error, fallback = "操作失败，请稍后重试") {
  if (error == null) return fallback;
  let raw =
    typeof error === "string"
      ? error
      : error?.message || error?.error || String(error);
  raw = String(raw || "").trim();
  if (!raw) return fallback;

  raw = raw
    .replace(/^Bad state:\s*/i, "")
    .replace(/^Exception:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/^AuthApiException:\s*/i, "")
    .trim();

  const mapped = mapKnown(raw);
  if (mapped) return mapped;
  if (looksMostlyChinese(raw)) return raw;
  return fallback;
}

function mapKnown(raw) {
  const s = raw.toLowerCase();

  if (
    s.includes("invalid login credentials") ||
    s.includes("invalid email or password") ||
    s.includes("email or password is incorrect")
  ) {
    return "邮箱或密码不正确";
  }
  if (
    s.includes("email not confirmed") ||
    s.includes("email address not confirmed") ||
    s.includes("尚未验证")
  ) {
    return "邮箱尚未验证，请先完成邮箱验证";
  }
  if (
    s.includes("user already registered") ||
    s.includes("already been registered") ||
    s.includes("user already exists") ||
    s.includes("该邮箱已注册")
  ) {
    return "该邮箱已注册，请直接登录；若尚未验证，请点「去验证邮箱」";
  }
  if (s.includes("user not found")) {
    return "账号不存在，请先注册";
  }
  if (
    s.includes("password should be at least") ||
    s.includes("password is too short") ||
    (s.includes("password") && s.includes("at least 6"))
  ) {
    return "密码至少 6 位";
  }
  if (
    s.includes("unable to validate email") ||
    s.includes("invalid email") ||
    s.includes("email format")
  ) {
    return "请输入合法邮箱";
  }
  if (
    s.includes("email rate limit") ||
    s.includes("over_email_send_rate_limit") ||
    s.includes("rate limit")
  ) {
    return "发送太频繁，请稍后再试";
  }
  if (
    s.includes("for security purposes") ||
    s.includes("only request this after")
  ) {
    return "操作太频繁，请稍后再试";
  }
  if (
    s.includes("token has expired") ||
    s.includes("otp_expired") ||
    s.includes("email link is invalid or has expired")
  ) {
    return "验证码已过期，请重新获取";
  }
  if (s.includes("token") && (s.includes("invalid") || s.includes("otp"))) {
    return "验证码不正确或已失效";
  }
  if (
    s.includes("network") ||
    s.includes("failed to fetch") ||
    s.includes("socket") ||
    s.includes("connection") ||
    s.includes("timed out") ||
    s.includes("timeout") ||
    s.includes("fetch failed")
  ) {
    return "网络异常，请检查网络后重试";
  }
  if (
    s.includes("jwt expired") ||
    (s.includes("session") && s.includes("expired")) ||
    s.includes("refresh token")
  ) {
    return "登录已过期，请重新登录";
  }
  if (s.includes("signup is disabled")) {
    return "当前未开放注册";
  }
  if (s.includes("weak password")) {
    return "密码过于简单，请换一个更安全的密码";
  }
  if (
    s.includes("same password") ||
    s.includes("should be different from the old password")
  ) {
    return "新密码不能与旧密码相同";
  }
  return null;
}

function looksMostlyChinese(s) {
  let cn = 0;
  let letters = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) cn += 1;
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      letters += 1;
    }
  }
  return cn > 0 && cn >= letters;
}
