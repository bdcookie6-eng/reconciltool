const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const PORT = process.env.PORT || 80;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS_CAP = 64000;

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self';"
  );
  next();
});

// Block cross-origin requests to the API proxy
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
    return res.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Serve only index.html — do not expose the whole project directory
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

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
  const { prompt, maxTokens } = req.body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing or invalid "prompt".' });
  }
  const MAX_PROMPT_LENGTH = 500 * 1024; // 500 KB
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'Prompt exceeds the maximum allowed length.' });
  }
  const tokens = Number.isInteger(maxTokens) && maxTokens >= 1 ? Math.min(maxTokens, MAX_TOKENS_CAP) : 1024;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 360000);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2024-06-01',
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
