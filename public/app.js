const chatEl = document.getElementById('chat');
const formEl = document.getElementById('chat-form');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const timerEl = document.getElementById('timer');
const timerValueEl = document.getElementById('timer-value');

let timerInterval = null;
let timerEndsAt = null;
let waitingBubbleEl = null;

function appendBubble(text, role) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.textContent = text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

function clearChat() {
  chatEl.innerHTML = '';
  waitingBubbleEl = null;
}

function setInputEnabled(enabled, { waiting = false } = {}) {
  inputEl.disabled = !enabled;
  sendBtn.disabled = !enabled;
  if (waiting) {
    inputEl.placeholder = 'Timer running — please wait...';
  } else if (enabled) {
    inputEl.placeholder = 'Type your message...';
  } else {
    inputEl.placeholder = 'Conversation complete';
  }
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Human text matching the countdown (same remaining ms as the header timer). */
function formatRemainingText(ms) {
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

function waitingMessage(ms) {
  return `Please wait — ${formatRemainingText(ms)} left. I will ask for your age after that.`;
}

function ensureWaitingBubble(ms) {
  const text = waitingMessage(ms);
  if (waitingBubbleEl && chatEl.contains(waitingBubbleEl)) {
    waitingBubbleEl.textContent = text;
  } else {
    waitingBubbleEl = appendBubble(text, 'agent');
  }
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerEndsAt = null;
  timerEl.hidden = true;
}

function startTimer(waitRemainingMs) {
  stopTimer();

  if (waitRemainingMs == null || waitRemainingMs <= 0) {
    return;
  }

  timerEndsAt = Date.now() + waitRemainingMs;
  timerEl.hidden = false;
  timerValueEl.textContent = formatCountdown(waitRemainingMs);
  ensureWaitingBubble(waitRemainingMs);

  timerInterval = setInterval(async () => {
    const remaining = timerEndsAt - Date.now();
    if (remaining <= 0) {
      timerValueEl.textContent = '0:00';
      if (waitingBubbleEl && chatEl.contains(waitingBubbleEl)) {
        waitingBubbleEl.textContent = 'Time is up.';
      }
      waitingBubbleEl = null;
      stopTimer();
      try {
        const res = await fetch('/api/state');
        const data = await res.json();
        if (data.prompt) {
          appendBubble(data.prompt, 'agent');
        }
        applyUiFromState(data, { skipWaitingBubble: true });
      } catch (err) {
        appendBubble('Could not refresh after timer. Please reload the page.', 'system');
      }
      return;
    }
    timerValueEl.textContent = formatCountdown(remaining);
    ensureWaitingBubble(remaining);
  }, 250);
}

function applyUiFromState(data, { skipWaitingBubble = false } = {}) {
  const isWaiting = data.step === 'waiting' && data.waitRemainingMs > 0;

  if (isWaiting) {
    startTimer(data.waitRemainingMs);
    setInputEnabled(false, { waiting: true });
    return;
  }

  stopTimer();
  if (!skipWaitingBubble) {
    waitingBubbleEl = null;
  }

  if (data.complete) {
    setInputEnabled(false);
  } else {
    setInputEnabled(true);
  }
}

async function loadState() {
  const res = await fetch('/api/state');
  const data = await res.json();

  if (data.step === 'waiting' && data.waitRemainingMs > 0) {
    // Show live remaining time (not a stale fixed duration)
    applyUiFromState(data);
  } else if (data.prompt) {
    appendBubble(data.prompt, 'agent');
    applyUiFromState(data);
  } else {
    applyUiFromState(data);
  }
}

async function startNewChat() {
  stopTimer();
  clearChat();
  setInputEnabled(true);

  try {
    const res = await fetch('/api/new-chat', { method: 'POST' });
    const data = await res.json();
    if (data.prompt) {
      appendBubble(data.prompt, 'agent');
    }
    applyUiFromState(data);
  } catch (err) {
    appendBubble('Could not start a new chat. Please try again.', 'system');
  }

  inputEl.focus();
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = inputEl.value.trim();
  if (!message) return;

  appendBubble(message, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (data.error) {
      appendBubble(data.error, 'system');
      sendBtn.disabled = false;
    } else if (data.reply) {
      if (data.step === 'waiting' && data.waitRemainingMs > 0) {
        // Live bubble + header timer use the same remaining time
        applyUiFromState(data);
      } else {
        appendBubble(data.reply, 'agent');
        applyUiFromState(data);
      }
    } else {
      sendBtn.disabled = false;
    }
  } catch (err) {
    appendBubble('Network error. Please try again.', 'system');
    sendBtn.disabled = false;
  }

  inputEl.focus();
});

newChatBtn.addEventListener('click', startNewChat);

loadState();
