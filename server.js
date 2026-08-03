require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const { getOrCreateSession, saveSession } = require('./src/sessionStore');
const { getPromptForSession, handleUserMessage } = require('./src/conversation');

const app = express();
const PORT = process.env.PORT || 3000;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function setSessionCookie(res, sessionId) {
  res.cookie('sessionId', sessionId, COOKIE_OPTS);
}

function ensureSession(req, res) {
  let sessionId = req.cookies.sessionId;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    setSessionCookie(res, sessionId);
  }
  const session = getOrCreateSession(sessionId);
  return session;
}

app.get('/api/state', (req, res) => {
  const session = ensureSession(req, res);
  const state = getPromptForSession(session);
  saveSession(session);
  res.json(state);
});

app.post('/api/chat', async (req, res) => {
  try {
    const session = ensureSession(req, res);
    const message = (req.body && req.body.message) || '';
    const result = await handleUserMessage(session, message);
    saveSession(session);
    res.json(result);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/new-chat', (req, res) => {
  const sessionId = crypto.randomUUID();
  setSessionCookie(res, sessionId);
  const session = getOrCreateSession(sessionId);
  const state = getPromptForSession(session);
  saveSession(session);
  res.json(state);
});

const server = app.listen(PORT, () => {
  console.log(`Hello Sara! listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the other process (or change PORT in .env), then try again.`
    );
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});
