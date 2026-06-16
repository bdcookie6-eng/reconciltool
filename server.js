const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PORT = process.env.PORT || 80;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS_CAP = 64000;

// ── Marketing bot data storage ──────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const FIRMS_FILE   = path.join(DATA_DIR, 'marketing-firms.json');
const REPORTS_FILE = path.join(DATA_DIR, 'marketing-reports.json');
const CONFIG_FILE  = path.join(DATA_DIR, 'marketing-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FIRMS_FILE))   fs.writeFileSync(FIRMS_FILE,   JSON.stringify({ firms: [] }, null, 2));
if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, JSON.stringify({ reports: [] }, null, 2));
if (!fs.existsSync(CONFIG_FILE))  fs.writeFileSync(CONFIG_FILE,  JSON.stringify({ googleApiKey: '', googleCxId: '', scheduleFrequency: 'weekly' }, null, 2));

if (!ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Block direct access to the data/ directory — it may contain API keys.
app.use('/data', (req, res) => res.status(403).end());

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

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

// ── Marketing Bot: config ────────────────────────────────────────────────────

app.get('/api/marketing/config', (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    res.json({ hasGoogleApiKey: !!cfg.googleApiKey, hasGoogleCxId: !!cfg.googleCxId, scheduleFrequency: cfg.scheduleFrequency });
  } catch { res.status(500).json({ error: 'Could not read config.' }); }
});

app.post('/api/marketing/config', (req, res) => {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const { googleApiKey, googleCxId, scheduleFrequency } = req.body || {};
    if (googleApiKey   !== undefined) cfg.googleApiKey   = String(googleApiKey).trim();
    if (googleCxId     !== undefined) cfg.googleCxId     = String(googleCxId).trim();
    if (scheduleFrequency !== undefined) cfg.scheduleFrequency = scheduleFrequency;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not save config.' }); }
});

// ── Marketing Bot: firms CRUD ────────────────────────────────────────────────

app.get('/api/marketing/firms', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(FIRMS_FILE, 'utf8'))); }
  catch { res.status(500).json({ error: 'Could not read firms.' }); }
});

app.post('/api/marketing/firms', (req, res) => {
  const { name, website, linkedin, facebook, instagram, googleBusiness, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Firm name is required.' });
  try {
    const data = JSON.parse(fs.readFileSync(FIRMS_FILE, 'utf8'));
    const firm = {
      id: crypto.randomUUID(),
      name: name.trim(),
      website: website?.trim() || '',
      linkedin: linkedin?.trim() || '',
      facebook: facebook?.trim() || '',
      instagram: instagram?.trim() || '',
      googleBusiness: googleBusiness?.trim() || '',
      notes: notes?.trim() || '',
      addedAt: new Date().toISOString()
    };
    data.firms.push(firm);
    fs.writeFileSync(FIRMS_FILE, JSON.stringify(data, null, 2));
    res.json(firm);
  } catch { res.status(500).json({ error: 'Could not save firm.' }); }
});

app.delete('/api/marketing/firms/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(FIRMS_FILE, 'utf8'));
    data.firms = data.firms.filter(f => f.id !== req.params.id);
    fs.writeFileSync(FIRMS_FILE, JSON.stringify(data, null, 2));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not delete firm.' }); }
});

// ── Marketing Bot: reports ───────────────────────────────────────────────────

app.get('/api/marketing/reports', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'))); }
  catch { res.status(500).json({ error: 'Could not read reports.' }); }
});

// ── Marketing Bot: scan ──────────────────────────────────────────────────────

const scanLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests. Please wait 5 minutes and try again.' }
});

async function callClaude(prompt, maxTokens = 2048) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await resp.json();
  return data?.content?.[0]?.text || '';
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/\s+/g, ' ')
             .trim();
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketingIntelBot/1.0)' }
    });
    const html = await resp.text();
    return { ok: true, text: stripHtml(html).substring(0, 10000) };
  } catch (e) {
    return { ok: false, text: '', error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function googleSearch(query, apiKey, cxId, dateRestrict = 'm1') {
  const url = `https://customsearch.googleapis.com/customsearch/v1?` +
    `q=${encodeURIComponent(query)}&cx=${encodeURIComponent(cxId)}&key=${encodeURIComponent(apiKey)}&num=5&dateRestrict=${dateRestrict}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (!resp.ok) return { ok: false, items: [], error: data?.error?.message || 'Search API error' };
    return { ok: true, items: (data.items || []).map(i => ({ title: i.title, snippet: i.snippet, link: i.link })) };
  } catch (e) {
    return { ok: false, items: [], error: e.message };
  }
}

app.post('/api/marketing/scan', scanLimiter, async (req, res) => {
  let firms, cfg;
  try {
    firms = JSON.parse(fs.readFileSync(FIRMS_FILE, 'utf8')).firms;
    cfg   = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch { return res.status(500).json({ error: 'Could not read data files.' }); }

  if (!firms.length) return res.status(400).json({ error: 'No competitor firms added yet.' });

  const hasGoogle = !!(cfg.googleApiKey && cfg.googleCxId);
  const firmReports = [];

  for (const firm of firms) {
    const gathered = {};

    // 1. Website content
    if (firm.website) {
      const result = await fetchText(firm.website);
      gathered.website = result.ok ? result.text : `[Could not fetch: ${result.error}]`;
    }

    // 2. Google Custom Search for social presence
    if (hasGoogle) {
      const searches = [
        { key: 'linkedin',  q: `"${firm.name}" site:linkedin.com` },
        { key: 'facebook',  q: `"${firm.name}" site:facebook.com` },
        { key: 'instagram', q: `"${firm.name}" site:instagram.com` },
        { key: 'google',    q: `"${firm.name}" accounting CPA reviews` },
      ];
      for (const { key, q } of searches) {
        const result = await googleSearch(q, cfg.googleApiKey, cfg.googleCxId);
        if (result.ok && result.items.length) {
          gathered[key] = result.items.map(i => `${i.title}: ${i.snippet}`).join('\n\n');
        }
      }
    }

    // 3. Per-firm Claude analysis
    const sections = Object.entries(gathered).map(([k, v]) =>
      `=== ${k.toUpperCase()} ===\n${v}`
    ).join('\n\n');

    const analysisPrompt = `You are a marketing analyst helping a CPA firm monitor its competition. Analyze the following data gathered about a competing CPA firm named "${firm.name}".

${sections || '[No data could be collected. Firm may have limited online presence.]'}

Provide a concise structured analysis:
**Recent Campaigns & Content** — What specific marketing content, posts, or campaigns are visible?
**Services Being Promoted** — Which accounting/tax/advisory services are featured?
**Brand Voice & Positioning** — How do they present themselves? What makes them distinct?
**Engagement Signals** — Any visible likes, shares, reviews, or reach indicators?
**3 Competitive Takeaways** — Specific actionable insights for our firm

Keep each section to 2–4 sentences. Be specific, not generic.`;

    let analysis = '';
    try { analysis = await callClaude(analysisPrompt, 1500); }
    catch (e) { analysis = `Analysis failed: ${e.message}`; }

    firmReports.push({
      firmId: firm.id,
      firmName: firm.name,
      scannedAt: new Date().toISOString(),
      platformsFound: Object.keys(gathered),
      analysis
    });
  }

  // 4. Overall digest
  let digest = '';
  if (firmReports.length > 0) {
    const digestPrompt = `You are a marketing strategist for a CPA firm. Below are competitive analyses of ${firmReports.length} similar accounting firms gathered from their websites and social media.

${firmReports.map(r => `--- ${r.firmName} ---\n${r.analysis}`).join('\n\n')}

Write an executive digest (3 short paragraphs):
1. Overall marketing trends you're seeing across these firms right now
2. The most interesting or differentiated approach spotted among them
3. Your top 3 specific, actionable recommendations for our firm based on these observations

Be direct and tactical.`;
    try { digest = await callClaude(digestPrompt, 1024); }
    catch {}
  }

  const report = {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    firmCount: firms.length,
    hasGoogleData: hasGoogle,
    firmReports,
    digest
  };

  try {
    const reportsData = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));
    reportsData.reports.unshift(report);
    if (reportsData.reports.length > 20) reportsData.reports = reportsData.reports.slice(0, 20);
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reportsData, null, 2));
  } catch { return res.status(500).json({ error: 'Could not save report.' }); }

  res.json(report);
});

app.listen(PORT, () => {
  console.log(`Reconcile Tool listening on port ${PORT}`);
});
