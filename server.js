const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 80;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // optional — enables "Run with AI"
const ACCESS_CODE = process.env.ACCESS_CODE; // optional — set to require a shared access code
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CAP = 64000;

if (!ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY is not set — "Run with AI" will be unavailable; "Run without AI" still works.');
}

const app = express();

// Behind Render's proxy the client IP arrives in X-Forwarded-For; without this
// the rate limiter would key every user on the proxy's IP (one shared bucket).
app.set('trust proxy', 1);

// Optional shared access code (HTTP Basic: user "sst", password = ACCESS_CODE).
if (ACCESS_CODE) {
  const expected = Buffer.from('Basic ' + Buffer.from('sst:' + ACCESS_CODE).toString('base64'));
  app.use((req, res, next) => {
    const got = Buffer.from(String(req.headers.authorization || ''));
    if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="SST Tools"');
    return res.status(401).send('Access code required — user "sst", password is the office access code.');
  });
}

app.use(express.json({ limit: '10mb' }));

// Serve an explicit allowlist — not the whole directory.
const FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/vendor/xlsx.full.min.js': 'node_modules/xlsx/dist/xlsx.full.min.js',
};
Object.entries(FILES).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, file)));
});

// Cap AI proxy usage per IP to control cost and abuse: 10 requests per 10 minutes.
const claudeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests from this device. Please wait a few minutes and try again.' }
});

// Server-side proxy: the API key lives only here and is never sent to the browser.
app.post('/api/claude', claudeLimiter, async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI is not configured on this server — use "Run without AI".' });
  }
  const { prompt, maxTokens } = req.body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing or invalid "prompt".' });
  }
  const tokens = Number.isInteger(maxTokens) ? Math.min(maxTokens, MAX_TOKENS_CAP) : 1024;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 360000);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: tokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const message = data?.error?.message || `Upstream API error (${upstream.status})`;
      return res.status(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502).json({ error: message });
    }

    const text = data?.content?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'AI returned an empty response.' });
    }

    return res.json({ text });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to the AI provider timed out.' });
    }
    console.error('Claude proxy error:', err.message);
    return res.status(502).json({ error: 'Failed to reach the AI provider.' });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, () => {
  console.log(`Reconcile Tool listening on port ${PORT}`);
});
