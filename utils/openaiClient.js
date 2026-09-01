const OPENAI_API_URL = 'https://api.openai.com/v1';

// RAG/tool-calling responses ke liye temperature jaan-boojh kar low rakhi hai (0 = pura
// deterministic, 1 = zyada random/creative). Humein chahiye ke bot sirf context/DB se di gayi
// info use kare aur khud se cheezein "invent" na kare — is liye 0.3, high-creativity range (0.7+) nahi.
const CHAT_TEMPERATURE = 0.3;

async function getEmbedding(text) {
  const res = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API failed: ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// Ek hi API call mein multiple texts ki embeddings mangwata hai (OpenAI embeddings
// endpoint ek array bhi accept karta hai). Knowledge Base documents mein bohot saare
// chunks ban sakte hain (200-page pdf => sau se zyada), isliye ek-ek text ke liye
// alag request bhejne se zyada behtar hai chunks ko batches mein bhej dena.
async function getEmbeddingsBatch(texts) {
  if (!texts.length) return [];

  const res = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API (batch) failed: ${errText}`);
  }

  const data = await res.json();
  // OpenAI response ka 'data' array input jaisi hi order mein aata hai
  return data.data.map((d) => d.embedding);
}

async function getChatCompletion(systemPrompt, userMessage, history = []) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: CHAT_TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API failed: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
async function getChatCompletionWithTools(messages, tools) {
  const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto', // Tool Selection: model khud decide karta hai koi tool chahiye ya nahi
      temperature: CHAT_TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API (tools) failed: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message; // { role, content, tool_calls? }
}

module.exports = { getEmbedding, getEmbeddingsBatch, getChatCompletion, getChatCompletionWithTools };