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

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) detail = errBody.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(detail || 'Ошибка Groq API');
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Пустой ответ модели');
  }
  return text;
}
