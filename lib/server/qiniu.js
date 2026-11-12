import crypto from "crypto";

function urlSafeBase64(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function qiniuConfigured() {
  return Boolean(
    process.env.QINIU_ACCESS_KEY?.trim() &&
      process.env.QINIU_SECRET_KEY?.trim() &&
      process.env.QINIU_BUCKET?.trim() &&
      process.env.QINIU_PUBLIC_BASE?.trim(),
  );
}

export function qiniuPublicUrl(objectKey) {
  const base = process.env.QINIU_PUBLIC_BASE.trim().replace(/\/+$/, "");
  const key = String(objectKey || "").replace(/^\/+/, "");
  return `${base}/${key}`;
}

export function qiniuUploadToken(objectKey, expiresSec = 3600) {
  const accessKey = process.env.QINIU_ACCESS_KEY.trim();
  const secretKey = process.env.QINIU_SECRET_KEY.trim();
  const bucket = process.env.QINIU_BUCKET.trim();
  const deadline = Math.floor(Date.now() / 1000) + expiresSec;
  const policy = JSON.stringify({
    scope: `${bucket}:${objectKey}`,
    deadline,
  });
  const encodedPolicy = urlSafeBase64(policy);
  const sign = crypto
    .createHmac("sha1", secretKey)
    .update(encodedPolicy)
    .digest();
  return `${accessKey}:${urlSafeBase64(sign)}:${encodedPolicy}`;
}

export function qiniuUploadHost() {
  return (
    process.env.QINIU_UPLOAD_HOST?.trim() || "https://up-as0.qiniup.com"
  ).replace(/\/+$/, "");
}

/** 服务端代传：multipart 到七牛 */
export async function qiniuPutBytes(objectKey, bytes, contentType = "image/jpeg") {
  if (!qiniuConfigured()) {
    throw new Error("未配置七牛（QINIU_*）");
  }
  const token = qiniuUploadToken(objectKey);
  const host = qiniuUploadHost();
  const form = new FormData();
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  form.append("token", token);
  form.append("key", objectKey);
  form.append(
    "file",
    new Blob([u8], { type: contentType }),
    objectKey.split("/").pop() || "file.bin",
  );
  const res = await fetch(host, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `七牛上传失败 ${res.status}`);
  }
  return qiniuPublicUrl(objectKey);
}
