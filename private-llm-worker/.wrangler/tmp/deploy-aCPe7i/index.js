var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MODEL = "@cf/zai-org/glm-4.7-flash";
var TOKEN_TTL_MS = 24 * 60 * 60 * 1e3;
var FIREBASE_PROJECT_ID = "knowaboutsam-40396";
var index_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/admin-login" && request.method === "POST") {
        return handleAdminLogin(request, env);
      }
      if (path === "/admin-verify" && request.method === "POST") {
        return handleAdminVerify(request, env);
      }
      if (path === "/posts" && request.method === "POST") {
        return requireAuth(request, env, (body2) => createDoc(env, "posts", {
          tag: body2.tag || "Note",
          body: body2.body,
          date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          createdAt: Date.now()
        }));
      }
      if (path.startsWith("/posts/") && request.method === "DELETE") {
        const id = path.split("/")[2];
        return requireAuth(request, env, () => deleteDocFn(env, "posts", id));
      }
      if (path === "/thoughts" && request.method === "POST") {
        return requireAuth(request, env, (body2) => createDoc(env, "thoughts", {
          title: body2.title,
          subtitle: body2.subtitle || "",
          body: body2.body,
          tag: "Personal",
          date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          createdAt: Date.now()
        }));
      }
      if (path.startsWith("/thoughts/") && request.method === "DELETE") {
        const id = path.split("/")[2];
        return requireAuth(request, env, () => deleteDocFn(env, "thoughts", id));
      }
      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      const body = await safeJson(request);
      if (!body?.question || typeof body.question !== "string") {
        return jsonResponse({ error: "Missing 'question' field" }, 400);
      }
      const systemPrompt = buildSystemPrompt(body.context);
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.question }
        ],
        max_tokens: 600,
        chat_template_kwargs: { enable_thinking: false }
      });
      const answer = result?.response || result?.choices?.[0]?.message?.content || result?.choices?.[0]?.message?.reasoning;
      if (!answer) return jsonResponse({ error: "No answer generated", raw: result }, 502);
      return jsonResponse({ answer: answer.trim() });
    } catch (err) {
      console.error("Worker error:", err);
      return jsonResponse({ error: "Something went wrong", detail: String(err) }, 500);
    }
  }
};
async function requireAuth(request, env, handler) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const payload = await verifyToken(token, env.ADMIN_TOKEN_SECRET);
  if (!payload || payload.exp < Date.now()) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const body = request.method !== "DELETE" ? await safeJson(request) : {};
  return handler(body || {});
}
__name(requireAuth, "requireAuth");
async function handleAdminLogin(request, env) {
  const body = await safeJson(request);
  const password = body?.password;
  if (!password || typeof password !== "string") {
    return jsonResponse({ error: "Missing 'password' field" }, 400);
  }
  if (password !== env.ADMIN_PASS) {
    await new Promise((r) => setTimeout(r, 400));
    return jsonResponse({ error: "Incorrect password" }, 401);
  }
  const token = await signToken({ exp: Date.now() + TOKEN_TTL_MS }, env.ADMIN_TOKEN_SECRET);
  return jsonResponse({ token });
}
__name(handleAdminLogin, "handleAdminLogin");
async function handleAdminVerify(request, env) {
  const body = await safeJson(request);
  const token = body?.token;
  if (!token) return jsonResponse({ valid: false }, 400);
  const payload = await verifyToken(token, env.ADMIN_TOKEN_SECRET);
  return jsonResponse({ valid: !!payload && payload.exp > Date.now() });
}
__name(handleAdminVerify, "handleAdminVerify");
async function signToken(payload, secret) {
  const payloadB64 = btoa(JSON.stringify(payload));
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}
__name(signToken, "signToken");
async function verifyToken(token, secret) {
  const [payloadB64, sig] = String(token).split(".");
  if (!payloadB64 || !sig) return null;
  const expected = await hmacSign(payloadB64, secret);
  if (sig !== expected) return null;
  try {
    return JSON.parse(atob(payloadB64));
  } catch {
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function hmacSign(message, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
}
__name(hmacSign, "hmacSign");
var cachedAccessToken = null;
var cachedAccessTokenExp = 0;
async function getAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExp - 6e4) {
    return cachedAccessToken;
  }
  const now = Math.floor(Date.now() / 1e3);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };
  const b64 = /* @__PURE__ */ __name((obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), "b64");
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${unsigned}.${sigB64}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get access token: " + JSON.stringify(data));
  cachedAccessToken = data.access_token;
  cachedAccessTokenExp = Date.now() + data.expires_in * 1e3;
  return cachedAccessToken;
}
__name(getAccessToken, "getAccessToken");
async function importPrivateKey(pem) {
  const body = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const binary = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
__name(importPrivateKey, "importPrivateKey");
function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") fields[k] = { integerValue: String(v) };
    else fields[k] = { stringValue: String(v ?? "") };
  }
  return { fields };
}
__name(toFirestoreFields, "toFirestoreFields");
async function createDoc(env, collection, data) {
  const accessToken = await getAccessToken(env);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(toFirestoreFields(data))
    }
  );
  const result = await res.json();
  if (!res.ok) return jsonResponse({ error: "Firestore write failed", detail: result }, 500);
  return jsonResponse({ ok: true, id: result.name?.split("/").pop() });
}
__name(createDoc, "createDoc");
async function deleteDocFn(env, collection, id) {
  if (!id) return jsonResponse({ error: "Missing id" }, 400);
  const accessToken = await getAccessToken(env);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return jsonResponse({ error: "Firestore delete failed", detail }, 500);
  }
  return jsonResponse({ ok: true });
}
__name(deleteDocFn, "deleteDocFn");
async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(safeJson, "safeJson");
function buildSystemPrompt(context) {
  return [
    "You are Private, Sameer Singh's AI portfolio assistant.",
    "Answer the visitor's question using ONLY the facts in the JSON context below.",
    "If the answer isn't in the context, say plainly that you don't have that information \u2014 never invent facts.",
    "Keep answers concise (2-4 sentences unless a list is clearly needed).",
    "Speak about Sameer in the third person, in a friendly, professional tone.",
    "",
    "CONTEXT:",
    JSON.stringify(context ?? {})
  ].join("\n");
}
__name(buildSystemPrompt, "buildSystemPrompt");
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() }
  });
}
__name(jsonResponse, "jsonResponse");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
