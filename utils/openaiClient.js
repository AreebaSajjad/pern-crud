const OPENAI_API_URL = 'https://api.openai.com/v1';

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
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Chat API (tools) failed: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message; // { role, content, tool_calls? }
}

module.exports = { getEmbedding, getChatCompletion, getChatCompletionWithTools };