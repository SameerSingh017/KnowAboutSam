
/**
 * private-llm-worker
 *
 * A Cloudflare Worker that answers visitor questions from Private
 * (the portfolio's chat widget) using Cloudflare Workers AI —
 * runs entirely on Cloudflare's infrastructure, no external API key,
 * no billing account, free up to 10,000 Neurons/day.
 *
 * Deploy:
 *   wrangler deploy
 *
 * (No secrets to set — Workers AI is accessed via the `AI` binding
 * declared in wrangler.toml, not an API key.)
 */
 
const MODEL = "@cf/zai-org/glm-4.7-flash"; // current active model as of mid-2026
 
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
 
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
 
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }
 
    const { question, context } = body;
    if (!question || typeof question !== "string") {
      return jsonResponse({ error: "Missing 'question' field" }, 400);
    }
 
    const systemPrompt = buildSystemPrompt(context);
 
    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        max_tokens: 600,
        chat_template_kwargs: { enable_thinking: false } // GLM-4.7-Flash: skip the reasoning step, answer directly
      });
 
      const answer =
        result?.response || // simple-format models
        result?.choices?.[0]?.message?.content || // OpenAI-style chat-completion models (e.g. GLM)
        result?.choices?.[0]?.message?.reasoning; // last-resort fallback if content ever comes back empty
 
      if (!answer) {
        return jsonResponse({ error: "No answer generated", raw: result }, 502);
      }
 
      return jsonResponse({ answer: answer.trim() });
    } catch (err) {
      console.error("Workers AI error:", err);
      return jsonResponse({ error: "Something went wrong", detail: String(err) }, 500);
    }
  }
};
 
function buildSystemPrompt(context) {
  return [
    "You are Private, Sameer Singh's AI portfolio assistant.",
    "Answer the visitor's question using ONLY the facts in the JSON context below.",
    "If the answer isn't in the context, say plainly that you don't have that information — never invent facts.",
    "Keep answers concise (2-4 sentences unless a list is clearly needed).",
    "Speak about Sameer in the third person, in a friendly, professional tone.",
    "",
    "CONTEXT:",
    JSON.stringify(context ?? {})
  ].join("\n");
}
 
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type"
  };
}
 
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() }
  });
}