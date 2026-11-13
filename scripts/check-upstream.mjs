/** 本机探测：直连 Supabase vs 经 EdgeOne /api/sb */
const anon = process.env.SUPABASE_ANON_KEY || "";
const direct = "https://aswbaolzgifcknnsryar.supabase.co";
const via = "http://otrue.top/api/sb";

async function probe(label, base) {
  const url = `${base}/rest/v1/notes?select=id&limit=1`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        apikey: anon || "x",
        Authorization: `Bearer ${anon || "x"}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    console.log(
      `${label}: HTTP ${res.status} ${Date.now() - t0}ms`,
      text.slice(0, 120).replace(/\s+/g, " "),
    );
  } catch (e) {
    console.log(`${label}: FAIL ${Date.now() - t0}ms`, e.cause?.code || e.message);
  }
}

await probe("direct supabase.co", direct);
await probe("via otrue.top/api/sb", via);
