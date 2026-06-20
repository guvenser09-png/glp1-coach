// ── Standalone Express server (local dev / non-Vercel hosting) ────────────────
// Wraps the same handler used by the Vercel route so you can run the AI proxy
// anywhere Node runs:  OPENAI_API_KEY=sk-... node server/index.js
//
// This is SERVER code and is NOT bundled into the React Native app.
const http = require('http');
const aiHandler = require('./api/ai');

const PORT = process.env.PORT || 8787;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === '/api/ai') {
    return aiHandler(req, res);
  }
  res.statusCode = 404;
  res.end('Not found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI proxy listening on http://localhost:${PORT}/api/ai`);
});
