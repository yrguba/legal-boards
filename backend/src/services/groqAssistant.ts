/** Groq Chat Completions (OpenAI‑compatible REST) — ключ только на сервере. */

type ChatRole = 'system' | 'user' | 'assistant';

export async function completeChat(messages: { role: ChatRole; content: string }[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('GROQ_API_KEY не задан на сервере');
  }

  const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  const rawBody = await res.text();

  if (!res.ok) {
    let detail = res.statusText || 'Ошибка Groq API';
    let code: string | undefined;
    try {
      const errBody = JSON.parse(rawBody) as {
        error?: { message?: string; code?: string };
      };
      if (errBody?.error?.message) detail = errBody.error.message;
      code = errBody?.error?.code;
    } catch {
      const trimmed = rawBody.trim();
      if (trimmed) detail = trimmed.length > 800 ? `${trimmed.slice(0, 800)}…` : trimmed;
    }
    const codePart = code ? ` [${code}]` : '';
    throw new Error(`Groq API ${res.status}: ${detail}${codePart}`);
  }

  const data = JSON.parse(rawBody) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Пустой ответ модели');
  }
  return text;
}
