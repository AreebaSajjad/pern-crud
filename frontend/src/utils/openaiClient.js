const OPENAI_API_URL = 'https://api.openai.com/v1';

// Text ko embedding (vector of numbers) mein convert karta hai.
// Yehi "Vector Embeddings" wala topic hai — text ko numeric representation
// mein badalna taake similarity math (cosine similarity) ho sake.
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

// Retrieved context + user ka sawal LLM ko bhejta hai, final answer generate karwata hai.
// Yehi "Working with LLM APIs" aur "Prompt Engineering" (system vs user prompt) wala hissa hai.
async function getChatCompletion(systemPrompt, userMessage) {
  const res = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API failed: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

module.exports = { getEmbedding, getChatCompletion };