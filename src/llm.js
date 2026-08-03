/**
 * Single-turn LLM helpers — no chat history is sent or stored.
 */

const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
}

/**
 * Extract a person's name from a single user message.
 * Falls back to a simple regex if no API key / API error.
 * @param {string} message
 * @returns {Promise<string|null>}
 */
async function extractName(message) {
  const fallback = extractNameFallback(message);
  const openai = getClient();

  if (!openai) {
    return fallback;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You extract a person\'s name from a short user message. ' +
            'Reply with JSON only: {"name":"<name>"} or {"name":null} if no valid personal name is present. ' +
            'A valid name is 1–40 characters, letters/spaces/hyphens/apostrophes only. ' +
            'Do not invent a name. Do not use chat history.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const name = typeof parsed.name === 'string' ? parsed.name.trim() : null;

    if (name && isValidName(name)) {
      return name;
    }
    return null;
  } catch (err) {
    console.warn('LLM extractName failed, using fallback:', err.message);
    return fallback;
  }
}

function isValidName(name) {
  if (!name || name.length < 1 || name.length > 40) return false;
  // Letters, spaces, hyphens, apostrophes
  return /^[A-Za-z][A-Za-z\s'-]*[A-Za-z]$|^[A-Za-z]$/.test(name);
}

function extractNameFallback(message) {
  if (!message || typeof message !== 'string') return null;

  const patterns = [
    /\b(?:my\s+name\s+is|i\s+am|i'm|this\s+is|call\s+me)\s+([A-Za-z][A-Za-z\s'-]{0,38}[A-Za-z]|[A-Za-z])\b/i,
    /^([A-Za-z][A-Za-z\s'-]{0,38}[A-Za-z]|[A-Za-z])$/,
  ];

  for (const re of patterns) {
    const m = message.trim().match(re);
    if (m) {
      // Cut off at conjunctions like "and I need..."
      let candidate = m[1].trim();
      candidate = candidate.split(/\s+and\s+/i)[0].trim();
      candidate = candidate.replace(/[.,!?]+$/, '').trim();
      if (isValidName(candidate)) return candidate;
    }
  }

  return null;
}

module.exports = {
  extractName,
  extractNameFallback,
  isValidName,
};
