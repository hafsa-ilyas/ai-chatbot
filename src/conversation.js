/**
 * Step machine: name → time → waiting → age → complete
 * Does not store chat history.
 */

const { parseDuration, parseAge, formatRemaining } = require('./timeParse');
const { extractName } = require('./llm');

function maybeAdvanceFromWaiting(session) {
  if (session.step === 'waiting' && session.waitUntil != null) {
    if (Date.now() >= session.waitUntil) {
      session.step = 'age';
    }
  }
}

function promptForStep(session) {
  maybeAdvanceFromWaiting(session);

  switch (session.step) {
    case 'name':
      return 'Hi, what is your name?';
    case 'time':
      return `Nice to meet you${session.name ? `, ${session.name}` : ''}! How much time do you need? (e.g. "3 minutes", "5 min", "1 hour")`;
    case 'waiting': {
      const remaining = Math.max(0, (session.waitUntil || 0) - Date.now());
      return `Please wait — ${formatRemaining(remaining)} left. I will ask for your age after that.`;
    }
    case 'age':
      return 'What is your age?';
    case 'complete':
      return `Thanks${session.name ? `, ${session.name}` : ''}! Your conversation is complete. (Age recorded: ${session.age})`;
    default:
      return 'Hi, what is your name?';
  }
}

/**
 * Build API state payload for page load / refresh (no chat history).
 */
function getPromptForSession(session) {
  maybeAdvanceFromWaiting(session);
  const prompt = promptForStep(session);
  const waitRemainingMs =
    session.step === 'waiting' && session.waitUntil != null
      ? Math.max(0, session.waitUntil - Date.now())
      : undefined;

  return {
    step: session.step,
    prompt,
    waitRemainingMs,
    complete: session.step === 'complete',
    name: session.name || undefined,
  };
}

function applyTime(session, durationResult) {
  session.durationMs = durationResult.durationMs;
  session.waitUntil = Date.now() + durationResult.durationMs;
  session.step = 'waiting';
}

/**
 * Handle one user message for the current session step.
 * @returns {Promise<{ reply: string, step: string, waitRemainingMs?: number, complete: boolean }>}
 */
async function handleUserMessage(session, message) {
  maybeAdvanceFromWaiting(session);

  const text = (message || '').trim();
  if (!text) {
    return {
      reply: promptForStep(session),
      step: session.step,
      complete: session.step === 'complete',
    };
  }

  if (session.step === 'complete') {
    return {
      reply: `This conversation is already complete. Thanks${session.name ? `, ${session.name}` : ''}!`,
      step: 'complete',
      complete: true,
    };
  }

  if (session.step === 'name') {
    const name = await extractName(text);
    if (!name) {
      return {
        reply: 'I could not find a valid name. Please tell me your name (e.g. "My name is John").',
        step: 'name',
        complete: false,
      };
    }

    session.name = name;

    // Multi-info: also accept a duration in the same message
    const duration = parseDuration(text);
    if (duration.ok) {
      applyTime(session, duration);
      const remaining = session.waitUntil - Date.now();
      return {
        reply: `Thanks, ${name}! I noted that you need ${duration.label}. Please wait ${formatRemaining(remaining)}. I will ask for your age after that.`,
        step: 'waiting',
        waitRemainingMs: remaining,
        complete: false,
      };
    }

    session.step = 'time';
    return {
      reply: `Nice to meet you, ${name}! How much time do you need? (e.g. "3 minutes", "5 min", "1 hour")`,
      step: 'time',
      complete: false,
    };
  }

  if (session.step === 'time') {
    const duration = parseDuration(text);
    if (!duration.ok) {
      return {
        reply:
          'That does not look like a valid time duration. Please reply with something like "3 minutes", "5 min", or "1 hour".',
        step: 'time',
        complete: false,
      };
    }

    applyTime(session, duration);
    const remaining = session.waitUntil - Date.now();
    return {
      reply: `Got it — ${duration.label}. Please wait ${formatRemaining(remaining)}. I will ask for your age after that.`,
      step: 'waiting',
      waitRemainingMs: remaining,
      complete: false,
    };
  }

  if (session.step === 'waiting') {
    const remaining = Math.max(0, (session.waitUntil || 0) - Date.now());
    if (remaining > 0) {
      return {
        reply: `Please wait a bit longer — about ${formatRemaining(remaining)} remaining. I will ask for your age when the time is up.`,
        step: 'waiting',
        waitRemainingMs: remaining,
        complete: false,
      };
    }

    // Time just elapsed during this request
    session.step = 'age';
    // Fall through to age handling with the same message
  }

  if (session.step === 'age') {
    // If we just transitioned from waiting, and the message was an early ping,
    // ask for age instead of trying to parse whatever they said during wait.
    // But if they sent an age after time elapsed, accept it.
    const ageResult = parseAge(text);

    // Detect "early" style messages that aren't ages (handled above usually).
    // If parse fails, ask for age.
    if (!ageResult.ok) {
      // If user just got here because wait ended mid-message that wasn't an age
      return {
        reply: 'What is your age? Please reply with a number between 1 and 120.',
        step: 'age',
        complete: false,
      };
    }

    session.age = ageResult.age;
    session.step = 'complete';
    session.completedAt = Date.now();

    return {
      reply: `Thanks, ${session.name}! Your age (${session.age}) is recorded. This conversation is complete.`,
      step: 'complete',
      complete: true,
    };
  }

  return {
    reply: promptForStep(session),
    step: session.step,
    complete: session.step === 'complete',
  };
}

module.exports = {
  getPromptForSession,
  handleUserMessage,
  promptForStep,
  maybeAdvanceFromWaiting,
};
