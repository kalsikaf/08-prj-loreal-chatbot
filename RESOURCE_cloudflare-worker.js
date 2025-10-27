export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Health-check / preview in browser
    if (request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, service: "loreal-chat-worker" }), { headers: cors });
    }

    try {
      // Only POST should carry messages
      const body = await request.json();
      const userMessages = Array.isArray(body?.messages) ? body.messages : [];

      // Enforce brand-safe scope server-side
      const systemPrompt = {
        role: "system",
        content:
          "You are “L’Oréal Beauty Chat Advisor.” Answer only L’Oréal product/routine questions; " +
          "politely refuse off-topic and steer back. Be concise, inclusive; avoid medical claims."
      };

      const messages = [systemPrompt, ...userMessages.filter(m => m.role !== "system")];

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages,
          max_completion_tokens: 350
        })
      });

      const data = await resp.json();
      return new Response(JSON.stringify(data), { headers: cors, status: resp.status });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err?.message || err) }), { headers: cors, status: 500 });
    }
  }
};