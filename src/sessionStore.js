/**
 * In-memory session store.
 * Stores only step state — never chat message history.
 */

const sessions = new Map();

function createEmptySession(id) {
  return {
    id,
    step: 'name', // name | time | waiting | age | complete
    name: null,
    durationMs: null,
    waitUntil: null,
    age: null,
    completedAt: null,
  };
}

function getOrCreateSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, createEmptySession(id));
  }
  return sessions.get(id);
}

function saveSession(session) {
  sessions.set(session.id, session);
}

function resetSession(id) {
  const session = createEmptySession(id);
  sessions.set(id, session);
  return session;
}

module.exports = {
  getOrCreateSession,
  saveSession,
  resetSession,
  createEmptySession,
};
