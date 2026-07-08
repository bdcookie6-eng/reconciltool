/* ── Clean Match — Unit Tests ───────────────────────────────────────────────
   Tests all core parsing, detection, extraction, and matching logic extracted
   from index.html. No browser APIs required — runs in plain Node.js.          */

'use strict';

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { process.stdout.write(`  ✓  ${label}\n`); passed++; }
  else       { process.stdout.write(`  ✗  ${label}\n`); failed++; }
}

function eq(a, b) {
  if (typeof a === 'object' && a !== null)
    return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

function section(title) {
  console.log(`\n━━━ ${title} ${'━'.repeat(Math.max(0, 60 - title.length))}\n`);
}

/* ══════════════════════════════════════════════════════════════════════════
   Extracted functions (mirrors index.html exactly — keep in sync)
   ══════════════════════════════════════════════════════════════════════════ */

function parseCSV(text) {
  return text.trim().split('\n').map(line => {
    const cols=[]; let cur=''; let inQ=false;
    for (const ch of line) {
      if (ch==='"') inQ=!inQ;
      else if (ch===',' && !inQ) { cols.push(cur.trim()); cur=''; }
      else cur+=ch;
    }
    cols.push(cur.trim()); return cols;
  });
}

function detectCols(headers) {
  const h = headers.map(x => x.toLowerCase());
  function find(kws) {
    for (const kw of kws) {
      const i = h.findIndex(x => x.includes(kw));
      if (i !== -1) return i;
    }
    return -1;
  }
  const numIdx  = find(['gl code','gl #','acct #','account #','account no','acct no','acct number','account number','gl','code','num']);
  const nameIdx = find(['account name','account desc','description','account','name','desc']);
  const drIdx   = find(['debit','dr ','dr$',' dr']);
  const crIdx   = find(['credit','cr ','cr$',' cr']);
  const balIdx  = find(['balance','amount','total','ytd','net']);
  return {
    num:  numIdx  >= 0 ? numIdx  : -1,
    name: nameIdx >= 0 ? nameIdx : 0,
    dr:   drIdx   >= 0 ? drIdx   : -1,
    cr:   crIdx   >= 0 ? crIdx   : -1,
    bal:  balIdx  >= 0 ? balIdx  : -1,
  };
}

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  let s = String(v).trim();
  const isParenWrapped = /^\(.*\)$/.test(s);
  s = s.replace(/[^0-9.\-eE+]/g, '');
  let n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (isParenWrapped) n = Math.abs(n);
  return n;
}

function extractRows(rows, cols) {
  const seen = new Set();
  const out  = [];
  const dupes = [];
  for (const r of rows) {
    const name = String(r[cols.name] ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) { dupes.push(name); continue; }
    seen.add(key);
    let dr = '', cr = '';
    if (cols.dr >= 0 || cols.cr >= 0) {
      let rawDr = parseNum(r[cols.dr]);
      let rawCr = parseNum(r[cols.cr]);
      if (rawDr < 0) { rawCr += -rawDr; rawDr = 0; }
      if (rawCr < 0) { rawDr += -rawCr; rawCr = 0; }
      dr = rawDr !== 0 ? rawDr : '';
      cr = rawCr !== 0 ? rawCr : '';
    } else if (cols.bal >= 0) {
      const bal = parseNum(r[cols.bal]);
      if (bal > 0)      dr = bal;
      else if (bal < 0) cr = Math.abs(bal);
    }
    out.push({
      num:  cols.num >= 0 ? String(r[cols.num] ?? '').trim() : '',
      name,
      dr,
      cr,
    });
  }
  return { rows: out, dupes };
}

function fmtChg(prev, curr) {
  if (!prev || !curr) return '';
  const delta = ((curr.dr||0) - (curr.cr||0)) - ((prev.dr||0) - (prev.cr||0));
  if (Math.abs(delta) < 0.005) return '';
  const abs = Math.abs(delta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return delta > 0 ? `+${abs}` : `(${abs})`;
}

function trialBalance(rows) {
  let totalDr = 0, totalCr = 0;
  for (const r of rows) {
    totalDr += typeof r.dr === 'number' ? r.dr : parseNum(r.dr);
    totalCr += typeof r.cr === 'number' ? r.cr : parseNum(r.cr);
  }
  const diff     = Math.abs(totalDr - totalCr);
  const balanced = diff < 0.005;
  return { totalDr, totalCr, diff, balanced };
}

const normName = s => String(s||'').trim().toLowerCase()
  .replace(/[-–—]/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

function matchAccounts(prevRows, currRows) {
  const currByName = new Map();
  for (const r of currRows) {
    const key = normName(r.name);
    if (!currByName.has(key)) currByName.set(key, []);
    currByName.get(key).push(r);
  }
  const matched = [];
  const unmatchedPrev = [];
  const unmatchedCurrSet = new Map(currRows.map(r => [r, true]));
  for (const p of prevRows) {
    const key = normName(p.name);
    const candidates = currByName.get(key);
    if (candidates && candidates.length) {
      const c = candidates.shift();
      if (!candidates.length) currByName.delete(key);
      matched.push({ prev: p, curr: c });
      unmatchedCurrSet.delete(c);
    } else {
      unmatchedPrev.push(p);
    }
  }
  return { matched, unmatchedPrev, unmatchedCurr: [...unmatchedCurrSet.keys()] };
}

const tokenSort = s => normName(s).split(' ').filter(Boolean).sort().join(' ');

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function nameSimilarity(a, b) {
  const x = tokenSort(a), y = tokenSort(b);
  const maxLen = Math.max(x.length, y.length);
  if (!maxLen) return 0;
  return 1 - levenshtein(x, y) / maxLen;
}

const FUZZY_THRESHOLD = 0.85;

function fuzzyMatchAccounts(prevPool, currPool) {
  const pairs = [];
  const usedPrev = new Set(), usedCurr = new Set();

  const currByNum = new Map();
  for (const c of currPool) {
    const num = String(c.num || '').trim();
    if (num && !currByNum.has(num)) currByNum.set(num, c);
  }
  for (const p of prevPool) {
    const num = String(p.num || '').trim();
    const c = num ? currByNum.get(num) : undefined;
    if (c && !usedCurr.has(c)) {
      pairs.push({ prev: p, curr: c });
      usedPrev.add(p); usedCurr.add(c);
    }
  }

  const candidates = [];
  for (const p of prevPool) {
    if (usedPrev.has(p)) continue;
    for (const c of currPool) {
      if (usedCurr.has(c)) continue;
      const score = nameSimilarity(p.name, c.name);
      if (score >= FUZZY_THRESHOLD) candidates.push({ p, c, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const { p, c } of candidates) {
    if (usedPrev.has(p) || usedCurr.has(c)) continue;
    pairs.push({ prev: p, curr: c });
    usedPrev.add(p); usedCurr.add(c);
  }
  return { pairs, usedPrev, usedCurr };
}

const CATEGORY_BASE = {
  'Assets': 1000, 'Liabilities': 2000, 'Equity': 3000,
  'Revenue': 4000, 'Cost of Revenue': 5000,
  'Operating Expenses': 6000, 'Other Income/Expense': 7000
};

function assignMissingAccountNumbers(categories, priorUsesNumbers) {
  if (!priorUsesNumbers) return;
  const hasNum = v => String(v || '').trim() !== '';
  const toInt = v => { const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10); return Number.isNaN(n) ? null : n; };

  const usedNumbers = new Set();
  const maxByCat = new Map();
  for (const cat of categories) {
    for (const row of cat.rows) {
      for (const side of [row.prev, row.curr]) {
        if (!side || !hasNum(side.num)) continue;
        usedNumbers.add(String(side.num).trim());
        const n = toInt(side.num);
        if (n !== null && (!maxByCat.has(cat.name) || n > maxByCat.get(cat.name))) {
          maxByCat.set(cat.name, n);
        }
      }
    }
  }

  const catCursor = new Map();
  const nextNumber = (catName) => {
    if (!catCursor.has(catName)) {
      catCursor.set(catName, maxByCat.has(catName) ? maxByCat.get(catName) : (CATEGORY_BASE[catName] ?? 9000));
    }
    let cursor = catCursor.get(catName);
    do { cursor += 10; } while (usedNumbers.has(String(cursor)));
    catCursor.set(catName, cursor);
    usedNumbers.add(String(cursor));
    return String(cursor);
  };

  for (const cat of categories) {
    for (const row of cat.rows) {
      if (!row.curr || hasNum(row.curr.num)) continue;
      if (row.status === 'matched' && row.prev && hasNum(row.prev.num)) continue;
      const num = nextNumber(cat.name);
      row.curr.num = num;
      row.curr.numGenerated = true;
      if (row.status === 'matched' && row.prev && !hasNum(row.prev.num)) {
        row.prev.num = num;
        row.prev.numGenerated = true;
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Tests
   ══════════════════════════════════════════════════════════════════════════ */

section('1. CSV Parsing');

(() => {
  const rows = parseCSV('Account Name,Debit,Credit\nCash,1000.00,\nAP,,500.00');
  assert(rows.length === 3, 'parses 3 rows including header');
  assert(rows[0][0] === 'Account Name', 'header col 0');
  assert(rows[1][1] === '1000.00', 'data debit value');
  assert(rows[2][2] === '500.00', 'data credit value');
  assert(rows[1][2] === '', 'empty credit cell is empty string');
})();

(() => {
  const rows = parseCSV('"Smith, Jones & Co",1500.00,\nRegular Account,200.00,');
  assert(rows[0][0] === 'Smith, Jones & Co', 'quoted value with comma preserved');
  assert(rows[1][0] === 'Regular Account', 'non-quoted value unaffected');
})();

(() => {
  const rows = parseCSV('  Account Name  ,  Debit  ,  Credit  ');
  assert(rows[0][0] === 'Account Name', 'leading/trailing spaces trimmed');
  assert(rows[0][1] === 'Debit', 'column header trimmed');
})();

section('2. Column Detection');

(() => {
  const cols = detectCols(['Account Name', 'Debit', 'Credit']);
  assert(cols.name === 0, 'Account Name → name col 0');
  assert(cols.dr   === 1, 'Debit → dr col 1');
  assert(cols.cr   === 2, 'Credit → cr col 2');
  assert(cols.num  === -1, 'no account number column');
  assert(cols.bal  === -1, 'no balance column');
})();

(() => {
  const cols = detectCols(['GL Code', 'Description', 'Debit', 'Credit']);
  assert(cols.num  === 0, 'GL Code → num col 0');
  assert(cols.name === 1, 'Description → name col 1');
  assert(cols.dr   === 2, 'Debit → dr col 2');
  assert(cols.cr   === 3, 'Credit → cr col 3');
})();

(() => {
  const cols = detectCols(['Account No', 'Account Name', 'Balance']);
  assert(cols.num  === 0, 'Account No → num');
  assert(cols.name === 1, 'Account Name → name');
  assert(cols.bal  === 2, 'Balance → bal');
  assert(cols.dr   === -1, 'no debit col');
  assert(cols.cr   === -1, 'no credit col');
})();

(() => {
  const cols = detectCols(['Acct #', 'Account', 'YTD Amount']);
  assert(cols.num  === 0, 'Acct # detected as num');
  assert(cols.name === 1, 'Account detected as name');
  assert(cols.bal  === 2, 'YTD Amount detected as bal');
})();

(() => {
  const cols = detectCols(['Name', 'Net']);
  assert(cols.name === 0, 'Name falls back to name col');
  assert(cols.bal  === 1, 'Net detected as balance');
})();

(() => {
  // First column fallback when no name keyword present
  const cols = detectCols(['Something', 'Amount']);
  assert(cols.name === 0, 'falls back to col 0 when no name keyword');
})();

section('3. Number Parsing');

assert(parseNum('1000.00')    === 1000,    'plain number');
assert(parseNum('1,234.56')   === 1234.56, 'comma-formatted number');
assert(parseNum('(500.00)')   === 500,     'parenthetical = positive magnitude');
assert(parseNum('($1,200.00)')=== 1200,    'parenthetical with dollar sign');
assert(parseNum('-750.00')    === -750,    'explicit negative stays negative');
assert(parseNum('')           === 0,       'empty string → 0');
assert(parseNum(null)         === 0,       'null → 0');
assert(parseNum(undefined)    === 0,       'undefined → 0');
assert(parseNum('abc')        === 0,       'non-numeric string → 0');
assert(parseNum(0)            === 0,       'zero number → 0');
assert(parseNum('0.00')       === 0,       'zero string → 0');
assert(parseNum('  1500  ')   === 1500,    'whitespace trimmed');
assert(parseNum('1.5e3')      === 1500,    'scientific notation');

section('4. Row Extraction — Debit/Credit columns');

(() => {
  const cols = { num: -1, name: 0, dr: 1, cr: 2, bal: -1 };
  const rows = [
    ['Cash', '45000.00', ''],
    ['Accounts Payable', '', '12000.00'],
  ];
  const { rows: out, dupes } = extractRows(rows, cols);
  assert(out.length === 2, 'extracts 2 accounts');
  assert(dupes.length === 0, 'no duplicates');
  assert(out[0].name === 'Cash', 'name preserved');
  assert(out[0].dr   === 45000, 'debit parsed correctly');
  assert(out[0].cr   === '', 'zero credit stored as empty string');
  assert(out[1].cr   === 12000, 'credit parsed correctly');
  assert(out[1].dr   === '', 'zero debit stored as empty string');
})();

(() => {
  const cols = { num: -1, name: 0, dr: 1, cr: 2, bal: -1 };
  const rows = [
    ['Allowance for Doubtful Accounts', '', '(125630.00)'],
  ];
  const { rows: out } = extractRows(rows, cols);
  assert(out[0].cr === 125630, 'parenthetical credit parsed as positive magnitude');
})();

(() => {
  // Sign anomaly: negative value in debit column should move to credit
  const cols = { num: -1, name: 0, dr: 1, cr: 2, bal: -1 };
  const rows = [['Contra Asset', '-5000', '']];
  const { rows: out } = extractRows(rows, cols);
  assert(out[0].dr === '',    'negative debit moved: dr is empty');
  assert(out[0].cr === 5000, 'negative debit moved: cr gets the value');
})();

(() => {
  // Duplicate account names — second should be skipped
  const cols = { num: -1, name: 0, dr: 1, cr: 2, bal: -1 };
  const rows = [
    ['Cash', '1000', ''],
    ['Cash', '2000', ''],
  ];
  const { rows: out, dupes } = extractRows(rows, cols);
  assert(out.length === 1, 'only first Cash kept');
  assert(dupes.length === 1, 'duplicate flagged');
  assert(dupes[0] === 'Cash', 'duplicate name reported');
})();

(() => {
  // Empty name rows should be skipped
  const cols = { num: -1, name: 0, dr: 1, cr: 2, bal: -1 };
  const rows = [['Cash', '1000', ''], ['', '', ''], ['  ', '0', '']];
  const { rows: out } = extractRows(rows, cols);
  assert(out.length === 1, 'blank/whitespace name rows skipped');
})();

(() => {
  // Account number included
  const cols = { num: 0, name: 1, dr: 2, cr: 3, bal: -1 };
  const rows = [['1010', 'Cash - Operating', '50000', '']];
  const { rows: out } = extractRows(rows, cols);
  assert(out[0].num === '1010', 'account number extracted');
  assert(out[0].name === 'Cash - Operating', 'account name extracted');
})();

section('5. Row Extraction — Balance column');

(() => {
  const cols = { num: -1, name: 0, dr: -1, cr: -1, bal: 1 };
  const rows = [
    ['Cash', '45000'],
    ['Accounts Payable', '-12000'],
    ['Zero Balance', '0'],
  ];
  const { rows: out } = extractRows(rows, cols);
  assert(out[0].dr === 45000, 'positive balance → debit');
  assert(out[0].cr === '',    'positive balance → cr empty');
  assert(out[1].cr === 12000, 'negative balance → credit (absolute)');
  assert(out[1].dr === '',    'negative balance → dr empty');
  assert(out[2].dr === '',    'zero balance → dr empty');
  assert(out[2].cr === '',    'zero balance → cr empty');
})();

section('6. Trial Balance');

(() => {
  const rows = [
    { dr: 50000, cr: '' },
    { dr: '',    cr: 30000 },
    { dr: 20000, cr: '' },
    { dr: '',    cr: 40000 },
  ];
  const tb = trialBalance(rows);
  assert(Math.abs(tb.totalDr - 70000) < 0.005, 'total debits correct');
  assert(Math.abs(tb.totalCr - 70000) < 0.005, 'total credits correct');
  assert(tb.balanced === true, 'balanced ledger detected');
})();

(() => {
  const rows = [
    { dr: 50000, cr: '' },
    { dr: '',    cr: 30000 },
  ];
  const tb = trialBalance(rows);
  assert(tb.balanced === false, 'unbalanced ledger detected');
  assert(Math.abs(tb.diff - 20000) < 0.005, 'difference calculated correctly');
})();

(() => {
  // Should not throw on empty array
  const tb = trialBalance([]);
  assert(tb.totalDr === 0 && tb.totalCr === 0, 'empty ledger returns zeros');
  assert(tb.balanced === true, 'empty ledger is balanced');
})();

section('7. Format Change (fmtChg)');

assert(fmtChg({dr:1000,cr:''}, {dr:1500,cr:''}) === '+500.00',  'debit increase → positive');
assert(fmtChg({dr:1500,cr:''}, {dr:1000,cr:''}) === '(500.00)', 'debit decrease → parenthetical');
assert(fmtChg({dr:'',cr:1000}, {dr:'',cr:1500}) === '(500.00)', 'credit increase → negative net');
assert(fmtChg({dr:1000,cr:''}, {dr:1000,cr:''}) === '',         'no change → empty string');
assert(fmtChg(null, {dr:1000,cr:''})             === '',         'null prev → empty string');
assert(fmtChg({dr:1000,cr:''}, null)             === '',         'null curr → empty string');
assert(fmtChg({dr:1000.001,cr:''},{dr:1000.003,cr:''}) === '',   'sub-cent diff ignored');

section('8. Account Name Normalisation');

assert(normName('Cash - Operating Account') === 'cash operating account', 'hyphens become spaces');
assert(normName('A/R – Trade')              === 'a r trade',              'em-dash handled');
assert(normName('  Prepaid   Insurance  ')  === 'prepaid insurance',      'extra whitespace collapsed');
assert(normName('401(k) Expense')           === '401 k expense',          'parens stripped');
assert(normName('')                         === '',                        'empty string safe');
assert(normName(null)                       === '',                        'null safe');
assert(
  normName('Consulting Revenue - Advisory') === normName('Consulting Revenue - Advisory'),
  'same name normalises identically'
);

section('9. Account Matching');

(() => {
  const prev = [
    { name: 'Cash', dr: 45000, cr: '', num: '' },
    { name: 'Accounts Payable', dr: '', cr: 12000, num: '' },
    { name: 'Old Account', dr: 1000, cr: '', num: '' },
  ];
  const curr = [
    { name: 'Cash', dr: 67000, cr: '', num: '' },
    { name: 'Accounts Payable', dr: '', cr: 15000, num: '' },
    { name: 'New Account', dr: 500, cr: '', num: '' },
  ];
  const { matched, unmatchedPrev, unmatchedCurr } = matchAccounts(prev, curr);
  assert(matched.length      === 2, '2 accounts matched by name');
  assert(unmatchedPrev.length === 1, '1 removed account (prev only)');
  assert(unmatchedCurr.length === 1, '1 added account (curr only)');
  assert(unmatchedPrev[0].name === 'Old Account', 'correct removed account');
  assert(unmatchedCurr[0].name === 'New Account', 'correct added account');
})();

(() => {
  // Hyphen/dash variations should match
  const prev = [{ name: 'Cash - Operating Account', dr: 1000, cr: '', num: '' }];
  const curr = [{ name: 'Cash – Operating Account', dr: 2000, cr: '', num: '' }];
  const { matched } = matchAccounts(prev, curr);
  assert(matched.length === 1, 'hyphen vs em-dash normalises to same match');
})();

(() => {
  // Case insensitive matching
  const prev = [{ name: 'accounts receivable', dr: 1000, cr: '', num: '' }];
  const curr = [{ name: 'Accounts Receivable',  dr: 2000, cr: '', num: '' }];
  const { matched } = matchAccounts(prev, curr);
  assert(matched.length === 1, 'case-insensitive name matching');
})();

(() => {
  // Both sides empty
  const { matched, unmatchedPrev, unmatchedCurr } = matchAccounts([], []);
  assert(matched.length === 0 && unmatchedPrev.length === 0 && unmatchedCurr.length === 0,
    'both sides empty — no crash');
})();

(() => {
  // Duplicate account name in curr — only first consumed per prev entry
  const prev = [
    { name: 'Cash', dr: 1000, cr: '', num: '' },
    { name: 'Cash', dr: 2000, cr: '', num: '' },
  ];
  const curr = [
    { name: 'Cash', dr: 3000, cr: '', num: '' },
  ];
  const { matched, unmatchedPrev } = matchAccounts(prev, curr);
  assert(matched.length      === 1, 'only one match when curr has one entry');
  assert(unmatchedPrev.length === 1, 'second prev Cash left unmatched');
})();

section('10. Fuzzy Matching');

assert(levenshtein('cash', 'cash') === 0, 'identical strings → distance 0');
assert(levenshtein('cash', '')     === 4, 'empty vs non-empty → full length');
assert(levenshtein('cash', 'csah') === 2, 'transposition counted as 2 edits');
assert(levenshtein('receivable', 'receiveable') === 1, 'single insertion → 1');

assert(nameSimilarity('Prepaid Insurance', 'Insurance - Prepaid') === 1, 'reordered tokens → similarity 1');
assert(nameSimilarity('Accounts Receivable', 'Accounts Receiveable') >= FUZZY_THRESHOLD, 'minor typo above threshold');
assert(nameSimilarity('Cash', 'Accounts Payable') < FUZZY_THRESHOLD, 'unrelated names below threshold');
assert(nameSimilarity('', '') === 0, 'both empty → 0, not a match');

(() => {
  // Same account number, renamed account — should pair by number
  const prev = [{ num: '6100', name: 'Marketing Expense',      dr: 5000, cr: '' }];
  const curr = [{ num: '6100', name: 'Advertising & Promotion', dr: 7000, cr: '' }];
  const { pairs } = fuzzyMatchAccounts(prev, curr);
  assert(pairs.length === 1, 'renamed account paired by exact account number');
})();

(() => {
  // No numbers — near-identical names should pair, unrelated ones should not
  const prev = [
    { num: '', name: 'Office Supplies Expense', dr: 1200, cr: '' },
    { num: '', name: 'Legal Fees',              dr: 3000, cr: '' },
  ];
  const curr = [
    { num: '', name: 'Office Supplies Expenses', dr: 1400, cr: '' },
    { num: '', name: 'Equipment Rental',         dr: 900,  cr: '' },
  ];
  const { pairs, usedPrev, usedCurr } = fuzzyMatchAccounts(prev, curr);
  assert(pairs.length === 1, 'one fuzzy name pair found');
  assert(pairs[0].prev.name === 'Office Supplies Expense', 'correct prev side paired');
  assert(pairs[0].curr.name === 'Office Supplies Expenses', 'correct curr side paired');
  assert(!usedPrev.has(prev[1]) && !usedCurr.has(curr[1]), 'unrelated accounts left unmatched');
})();

(() => {
  // User workflow: prior year has account numbers, current year has none —
  // fuzzy name matching pairs them so numbers can be carried forward
  const prev = [
    { num: '1010', name: 'Cash - Operating',    dr: 45000, cr: '' },
    { num: '1200', name: 'Accounts Receivable', dr: 12000, cr: '' },
  ];
  const curr = [
    { num: '', name: 'Operating Cash',            dr: 51000, cr: '' },
    { num: '', name: 'Accounts Receiveable',      dr: 15000, cr: '' },
  ];
  const { pairs } = fuzzyMatchAccounts(prev, curr);
  assert(pairs.length === 2, 'both accounts paired despite missing numbers');
  const cash = pairs.find(p => p.prev.num === '1010');
  assert(cash && cash.curr.name === 'Operating Cash', 'reordered name paired to numbered prior account');
})();

(() => {
  // Each account consumed at most once — best score wins
  const prev = [{ num: '', name: 'Rent Expense', dr: 1000, cr: '' }];
  const curr = [
    { num: '', name: 'Rent Expenses', dr: 1100, cr: '' },
    { num: '', name: 'Rent Expense',  dr: 1200, cr: '' },
  ];
  const { pairs } = fuzzyMatchAccounts(prev, curr);
  assert(pairs.length === 1, 'single prev account pairs only once');
  assert(pairs[0].curr.name === 'Rent Expense', 'exact-scoring candidate wins over weaker one');
})();

(() => {
  const { pairs } = fuzzyMatchAccounts([], []);
  assert(pairs.length === 0, 'empty pools — no crash, no pairs');
})();

section('11. Account Number Generation');

(() => {
  // Prior year numbered; current year has a brand-new account with no number
  const categories = [{
    name: 'Operating Expenses',
    rows: [
      { status: 'matched', prev: { num: '6010', name: 'Rent', dr: 1000, cr: '' }, curr: { num: '6010', name: 'Rent', dr: 1100, cr: '' } },
      { status: 'added',   prev: null, curr: { num: '', name: 'Software Subscriptions', dr: 500, cr: '' } },
    ],
  }];
  assignMissingAccountNumbers(categories, true);
  const added = categories[0].rows[1].curr;
  assert(added.num !== '' && added.num != null, 'new account received a number');
  assert(added.numGenerated === true, 'generated number flagged');
  assert(Number(added.num) > 6010, 'number placed after existing category numbers');
})();

(() => {
  // No numbering anywhere in the prior year → nothing is invented
  const categories = [{
    name: 'Assets',
    rows: [{ status: 'added', prev: null, curr: { num: '', name: 'New Asset', dr: 1, cr: '' } }],
  }];
  assignMissingAccountNumbers(categories, false);
  assert(categories[0].rows[0].curr.num === '', 'no numbers generated when prior year is unnumbered');
})();

(() => {
  // Matched pair with no number on either side → one shared number on both
  const categories = [{
    name: 'Revenue',
    rows: [{ status: 'matched', prev: { num: '', name: 'Consulting', dr: '', cr: 9000 }, curr: { num: '', name: 'Consulting', dr: '', cr: 9500 } }],
  }];
  assignMissingAccountNumbers(categories, true);
  const { prev, curr } = categories[0].rows[0];
  assert(curr.num !== '', 'matched pair current side numbered');
  assert(prev.num === curr.num, 'both sides share the same number');
  assert(prev.numGenerated && curr.numGenerated, 'both sides flagged as generated');
})();

(() => {
  // A matched pair whose prior side is numbered is left for the carry-forward
  // pass — the generator does not invent a competing number.
  const categories = [{
    name: 'Liabilities',
    rows: [{ status: 'matched', prev: { num: '2010', name: 'AP', dr: '', cr: 500 }, curr: { num: '', name: 'AP', dr: '', cr: 600 } }],
  }];
  assignMissingAccountNumbers(categories, true);
  assert(categories[0].rows[0].curr.num === '', 'numbered-prev matched pair left for carry-forward');
})();

(() => {
  // Generated numbers are unique and never collide with existing ones
  const categories = [{
    name: 'Assets',
    rows: [
      { status: 'matched', prev: { num: '1010', name: 'Cash', dr: 1, cr: '' }, curr: { num: '1010', name: 'Cash', dr: 1, cr: '' } },
      { status: 'matched', prev: { num: '1020', name: 'AR',   dr: 1, cr: '' }, curr: { num: '1020', name: 'AR',   dr: 1, cr: '' } },
      { status: 'added',   prev: null, curr: { num: '', name: 'New A', dr: 1, cr: '' } },
      { status: 'added',   prev: null, curr: { num: '', name: 'New B', dr: 1, cr: '' } },
    ],
  }];
  assignMissingAccountNumbers(categories, true);
  const nums = categories[0].rows.map(r => r.curr.num);
  assert(nums.every(n => n !== ''), 'every current account is numbered');
  assert(new Set(nums).size === nums.length, 'all current-side numbers are unique');
  assert(!nums.includes('1010') || nums.filter(n => n === '1010').length === 1, 'generated numbers do not reuse existing ones');
})();

(() => {
  // Current file with NO numbers at all, prior fully numbered (via fuzzy match):
  // matched pairs carry forward, new accounts get fresh numbers → whole side numbered
  const categories = [{
    name: 'Assets',
    rows: [
      // carry-forward already applied here (curr inherited prior number)
      { status: 'matched', prev: { num: '1010', name: 'Cash', dr: 1, cr: '' }, curr: { num: '1010', name: 'Cash', numInherited: true, dr: 1, cr: '' } },
      { status: 'added',   prev: null, curr: { num: '', name: 'Crypto Wallet', dr: 1, cr: '' } },
    ],
  }];
  assignMissingAccountNumbers(categories, true);
  assert(categories[0].rows.every(r => r.curr.num !== ''), 'entire new side ends up numbered');
})();

section('12. End-to-End CSV → Extraction → Trial Balance');

(() => {
  const csv = [
    'Account Name,Debit,Credit',
    'Cash,45200.00,',
    'Accounts Receivable,128500.00,',
    'Accounts Payable,,32400.00',
    'Common Stock,,10000.00',
    'Retained Earnings,,89700.00',
    'Consulting Revenue,,185000.00',
    'Salaries Expense,96000.00,',
    'Rent Expense,18000.00,',
    'Income Tax Expense,14400.00,',
    '',
  ].join('\n');

  const allRows = parseCSV(csv);
  const dataRows = allRows.slice(1); // strip header
  const cols = detectCols(allRows[0]);
  const { rows, dupes } = extractRows(dataRows, cols);

  assert(cols.name === 0 && cols.dr === 1 && cols.cr === 2, 'columns detected from CSV header');
  assert(dupes.length === 0, 'no duplicates in clean file');
  assert(rows.length === 9, 'blank trailing row skipped, 9 accounts extracted');

  const tb = trialBalance(rows);
  const expectedDr = 45200 + 128500 + 96000 + 18000 + 14400;
  const expectedCr = 32400 + 10000 + 89700 + 185000;
  assert(Math.abs(tb.totalDr - expectedDr) < 0.005, `total debits = ${expectedDr}`);
  assert(Math.abs(tb.totalCr - expectedCr) < 0.005, `total credits = ${expectedCr}`);
})();

(() => {
  // Test against the actual test-data files
  const fs = require('fs');
  const path = require('path');
  const febPath = path.join(__dirname, '../test-data/trial_balance_feb_2024.csv');
  const marPath = path.join(__dirname, '../test-data/trial_balance_mar_2024.csv');

  if (!fs.existsSync(febPath) || !fs.existsSync(marPath)) {
    console.log('  ⚠  Test data files not found — skipping file-based tests');
    return;
  }

  for (const [label, filePath] of [['Feb 2024', febPath], ['Mar 2024', marPath]]) {
    const allRows = parseCSV(fs.readFileSync(filePath, 'utf8'));
    const cols = detectCols(allRows[0]);
    const { rows, dupes } = extractRows(allRows.slice(1), cols);

    assert(cols.name >= 0,         `${label}: name column detected`);
    assert(cols.dr   >= 0,         `${label}: debit column detected`);
    assert(cols.cr   >= 0,         `${label}: credit column detected`);
    assert(rows.length >= 150,     `${label}: at least 150 accounts parsed (got ${rows.length})`);
    assert(dupes.length === 0,     `${label}: no duplicate account names`);

    const tb = trialBalance(rows);
    assert(tb.totalDr > 0,         `${label}: total debits > 0`);
    assert(tb.totalCr > 0,         `${label}: total credits > 0`);
  }

  // Test matching between feb and mar
  const febRows = parseCSV(fs.readFileSync(febPath, 'utf8'));
  const marRows = parseCSV(fs.readFileSync(marPath, 'utf8'));
  const febCols = detectCols(febRows[0]);
  const marCols = detectCols(marRows[0]);
  const { rows: prev } = extractRows(febRows.slice(1), febCols);
  const { rows: curr } = extractRows(marRows.slice(1), marCols);
  const { matched, unmatchedPrev, unmatchedCurr } = matchAccounts(prev, curr);

  assert(matched.length >= 150, `Feb→Mar: at least 150 accounts matched (got ${matched.length})`);
  assert(unmatchedPrev.length < 5, `Feb→Mar: fewer than 5 unmatched prev accounts (got ${unmatchedPrev.length})`);
  assert(unmatchedCurr.length < 5, `Feb→Mar: fewer than 5 unmatched curr accounts (got ${unmatchedCurr.length})`);
})();

(() => {
  // Simpler test data files
  const fs = require('fs');
  const path = require('path');
  const priorPath   = path.join(__dirname, '../test-data/ledger_prior_period.csv');
  const currentPath = path.join(__dirname, '../test-data/ledger_current_period.csv');

  if (!fs.existsSync(priorPath) || !fs.existsSync(currentPath)) {
    console.log('  ⚠  Simple ledger test files not found — skipping');
    return;
  }

  for (const [label, filePath] of [['Prior period', priorPath], ['Current period', currentPath]]) {
    const allRows = parseCSV(fs.readFileSync(filePath, 'utf8'));
    const cols = detectCols(allRows[0]);
    const { rows } = extractRows(allRows.slice(1), cols);
    assert(rows.length === 31, `${label}: all 31 accounts parsed (got ${rows.length})`);
  }

  const priorRows   = parseCSV(fs.readFileSync(priorPath, 'utf8'));
  const currentRows = parseCSV(fs.readFileSync(currentPath, 'utf8'));
  const pc = detectCols(priorRows[0]);
  const cc = detectCols(currentRows[0]);
  const { rows: pRows } = extractRows(priorRows.slice(1), pc);
  const { rows: cRows } = extractRows(currentRows.slice(1), cc);
  const { matched } = matchAccounts(pRows, cRows);
  assert(matched.length === 31, `Simple ledgers: all 31 accounts match (got ${matched.length})`);
})();

/* ══════════════════════════════════════════════════════════════════════════
   Results
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'═'.repeat(68)}`);
console.log(`  Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log(`${'═'.repeat(68)}\n`);

if (failed > 0) process.exit(1);
