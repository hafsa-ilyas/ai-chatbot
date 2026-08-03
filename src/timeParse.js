/**
 * Deterministic duration and age parsers.
 */

const UNIT_MS = {
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  mins: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hrs: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
};

const DURATION_RE =
  /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i;

const VAGUE_TIME_RE =
  /\b(later|soon|whenever|sometime|a\s+while|not\s+sure|idk|dunno)\b/i;

/**
 * @param {string} text
 * @returns {{ ok: true, durationMs: number, label: string } | { ok: false, reason: string }}
 */
function parseDuration(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const trimmed = text.trim();
  if (VAGUE_TIME_RE.test(trimmed) && !DURATION_RE.test(trimmed)) {
    return { ok: false, reason: 'vague' };
  }

  const match = trimmed.match(DURATION_RE);
  if (!match) {
    return { ok: false, reason: 'unparseable' };
  }

  const amount = parseFloat(match[1]);
  const unitKey = match[2].toLowerCase();
  const msPerUnit = UNIT_MS[unitKey];

  if (!msPerUnit || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'invalid' };
  }

  // Cap at 24 hours for demos
  const durationMs = Math.min(amount * msPerUnit, 24 * 60 * 60 * 1000);
  const label = `${amount} ${match[2].toLowerCase()}`;

  return { ok: true, durationMs: Math.round(durationMs), label };
}

/**
 * @param {string} text
 * @returns {{ ok: true, age: number } | { ok: false, reason: string }}
 */
function parseAge(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, reason: 'empty' };
  }

  const trimmed = text.trim();

  // Prefer a standalone number, or "I am 32", "age is 32"
  let match = trimmed.match(/\b(?:i\s*(?:am|'m)|age\s*(?:is|:)?|years?\s*old[:\s]*)\s*(\d{1,3})\b/i);
  if (!match) {
    match = trimmed.match(/^(\d{1,3})$/);
  }
  if (!match) {
    match = trimmed.match(/\b(\d{1,3})\s*(?:years?\s*old)?\b/);
  }

  if (!match) {
    return { ok: false, reason: 'unparseable' };
  }

  const age = parseInt(match[1], 10);
  if (!Number.isFinite(age) || age < 1 || age > 120) {
    return { ok: false, reason: 'out_of_range' };
  }

  return { ok: true, age };
}

/**
 * Format remaining wait time for user-facing messages (actual leftover time).
 * @param {number} ms
 */
function formatRemaining(ms) {
  if (ms <= 0) return '0 seconds';

  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const parts = [];
  if (hours > 0) parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
  if (mins > 0) parts.push(mins === 1 ? '1 minute' : `${mins} minutes`);
  if (secs > 0 || parts.length === 0) {
    parts.push(secs === 1 ? '1 second' : `${secs} seconds`);
  }

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

module.exports = {
  parseDuration,
  parseAge,
  formatRemaining,
};
