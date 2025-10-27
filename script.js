/* ======== CONFIG ======== */
// If you set this in secrets.js: const CF_WORKER_URL="https://...workers.dev"
const WORKER_URL = (typeof CF_WORKER_URL === "string" && CF_WORKER_URL) ? CF_WORKER_URL : "";

// Local testing fallback (only used when no WORKER_URL and a local OPENAI_API_KEY is present)
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/* L’Oréal-only system prompt */
const SYSTEM_PROMPT = `
You are “L’Oréal Beauty Chat Advisor,” a helpful, brand-safe assistant.

SCOPE:
- Only answer questions about L’Oréal products (makeup, skincare, haircare, fragrance), ingredients, routines, shade matching, application tips, and high-level beauty guidance.
- Personalize by asking for relevant details (skin type, concerns, hair goals, budget).
- If asked unrelated questions, politely refuse and steer back to L’Oréal topics.

TONE:
- Friendly, concise, inclusive, and accessible. Avoid medical claims; encourage patch tests.
- If unsure, say so.

REFUSAL:
- Off-topic → brief refusal + invite a L’Oréal-related question.
`;

/* ======== DOM ======== */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const latestQuestion = document.getElementById("latestQuestion");
const latestQuestionText = document.getElementById("latestQuestionText");

/* ======== Conversation State ======== */
const messages = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "assistant", content: "Bonjour! I’m your L’Oréal Beauty Chat Advisor. How can I help with products or routines today?" }
];
appendMessage("ai", messages[1].content);

/* ======== Events ======== */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage("user", text);
  latestQuestionText.textContent = text;
  latestQuestion.style.display = "block";
  latestQuestion.setAttribute("aria-hidden", "false");

  messages.push({ role: "user", content: text });

  const typingId = appendTyping();

  try {
    const reply = await getAIResponse(messages);
    removeTyping(typingId);
    appendMessage("ai", reply);
    messages.push({ role: "assistant", content: reply });
  } catch (err) {
    removeTyping(typingId);
    appendMessage(
      "ai",
      `Connection error: ${String(err.message || err)}.
Check that:
• If using Worker: CF_WORKER_URL is set in secrets.js
• In Cloudflare: OPENAI_API_KEY secret is added and Worker is deployed`
    );
    console.error(err);
  } finally {
    userInput.value = "";
    userInput.focus();
  }
});

/* ======== UI helpers ======== */
function appendMessage(sender, text){
  const wrap = document.createElement("div");
  wrap.className = `msg ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function appendTyping(){
  const id = `typing-${Date.now()}`;
  const wrap = document.createElement("div");
  wrap.className = "msg ai";
  wrap.id = id;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return id;
}
function removeTyping(id){ const el = document.getElementById(id); if (el) el.remove(); }

/* ======== Network ======== */
async function getAIResponse(history){
  // Preferred path: Cloudflare Worker
  if (WORKER_URL) {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });
    if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Worker returned no content");
    return content;
  }

  // Fallback: local direct to OpenAI for private testing ONLY
  if (typeof OPENAI_API_KEY === "string" && OPENAI_API_KEY) {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: history,
        max_completion_tokens: 350
      })
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("OpenAI returned no content");
    return content;
  }

  // Neither Worker nor local key configured
  throw new Error("No WORKER_URL or local OPENAI_API_KEY configured.");
}

