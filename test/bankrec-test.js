#!/usr/bin/env node
// Stress test suite for the bank reconciliation matching algorithm.
// Mirrors every core function from bankrec.html so tests run in Node.js.

// ══════════════════════════════════════════════════════════════════════════════
// Core functions (keep in sync with bankrec.html)
// ══════════════════════════════════════════════════════════════════════════════

function parseNum(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const s = String(v).trim();
  const isParens = /^\(.*\)$/.test(s);
  const n = parseFloat(s.replace(/[^0-9.\-eE+]/g, ''));
  if (isNaN(n)) return 0;
  return isParens ? -Math.abs(n) : n;
}

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

function parseDate(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && val > 10000 && val < 100000) {
    return new Date(Math.round((val - 25569) * 86400 * 1000));
  }
  const s = String(val).trim();
  if (!s) return null;
  const serial = Number(s);
  if (Number.isInteger(serial) && serial > 10000 && serial < 100000 && String(serial) === s) {
    return new Date(Math.round((serial - 25569) * 86400 * 1000));
  }
  const stripped = s.replace(/T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(stripped)) {
    const [y, m, d] = stripped.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  const slash = stripped.split(/[\/-]/);
  if (slash.length === 3) {
    const [a, b, c] = slash.map(Number);
    if (a > 1900) return new Date(a, b-1, c);
    const yr = c < 100 ? (c < 50 ? 2000+c : 1900+c) : c;
    return new Date(yr, a-1, b);
  }
  const wordMatch = stripped.match(/(\d{1,2})[\- ]([A-Za-z]{3,})[\- ,]+(\d{4})|([A-Za-z]{3,})[\- ]+(\d{1,2})[,\- ]+(\d{4})/);
  if (wordMatch) {
    if (wordMatch[1]) {
      const mo = MONTHS[wordMatch[2].toLowerCase().slice(0,3)];
      if (mo !== undefined) return new Date(+wordMatch[3], mo, +wordMatch[1]);
    } else {
      const mo = MONTHS[wordMatch[4].toLowerCase().slice(0,3)];
      if (mo !== undefined) return new Date(+wordMatch[6], mo, +wordMatch[5]);
    }
  }
  const native = new Date(stripped);
  if (!isNaN(native) && native.getFullYear() > 1970 && native.getFullYear() < 2100) return native;
  return null;
}

function detectCols(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim());
  const find = (...kws) => {
    for (const kw of kws) {
      const i = h.findIndex(x => x === kw || x.includes(kw));
      if (i !== -1) return i;
    }
    return -1;
  };
  const debit  = find('withdrawal', 'withdrawals', 'debit', 'debits', 'payment', 'payments', 'spent', 'charges', 'dr', 'amount out', 'money out');
  const credit = find('deposit', 'deposits', 'credit', 'credits', 'receipt', 'receipts', 'received', 'cr', 'amount in', 'money in');
  const amount = (debit < 0 && credit < 0) ? find('amount', 'total', 'net', 'value', 'sum', 'transaction amount') : -1;
  return {
    date:   find('date', 'post date', 'posted', 'trans date', 'transaction date', 'value date', 'effective date', 'settlement date'),
    desc:   find('description', 'memo', 'particulars', 'details', 'narration', 'payee', 'narrative', 'text', 'reference', 'remarks', 'note'),
    debit, credit, amount,
    balance: find('balance', 'running balance', 'ledger balance', 'available balance'),
  };
}

function datesEqual(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function daysDiff(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(a - b) / 86400000;
}
function amountsMatch(a, b) {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
}
function amountsNear(a, b) {
  const diff = Math.abs(Math.abs(a) - Math.abs(b));
  const tol  = Math.max(0.50, Math.max(Math.abs(a), Math.abs(b)) * 0.01);
  return diff > 0.005 && diff <= tol;
}

const DESC_STOPWORDS = new Set(['the','and','for','from','via','ref','to','at','in','on','of','by','or','a','an','ltd','inc','llc','co']);
function tokenizeDesc(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g,' ').split(/\s+/).filter(t => t.length > 1 && !DESC_STOPWORDS.has(t));
}
function descSimilarity(a, b) {
  const tokA = tokenizeDesc(a);
  const tokB = tokenizeDesc(b);
  if (!tokA.length || !tokB.length) return 0;
  const setA = new Set(tokA);
  const setB = new Set(tokB);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) { inter++; continue; }
    if (t.length >= 4) {
      for (const u of setB) {
        if (u.length >= 4 && (u.startsWith(t) || t.startsWith(u))) { inter += 0.5; break; }
      }
    }
  }
  return inter / (setA.size + setB.size - inter);
}

function matchTxns(bankTxns, bookTxns) {
  const usedBank = new Set();
  const usedBook = new Set();
  const matched  = [];

  function tryMatch(bi, ri, confidence, extra) {
    matched.push({ bank: bankTxns[bi], book: bookTxns[ri], confidence, ...extra });
    usedBank.add(bi); usedBook.add(ri);
  }

  // Pass 1: exact date + exact absolute amount
  for (let bi = 0; bi < bankTxns.length; bi++) {
    const b = bankTxns[bi];
    for (let ri = 0; ri < bookTxns.length; ri++) {
      if (usedBook.has(ri)) continue;
      if (datesEqual(b.date, bookTxns[ri].date) && amountsMatch(b.amount, bookTxns[ri].amount)) {
        tryMatch(bi, ri, 'exact', {}); break;
      }
    }
  }
  // Pass 2: ±3 days + exact amount
  for (let bi = 0; bi < bankTxns.length; bi++) {
    if (usedBank.has(bi)) continue;
    const b = bankTxns[bi];
    const cands = bookTxns
      .map((r, ri) => ({ ri, diff: daysDiff(b.date, r.date) }))
      .filter(c => !usedBook.has(c.ri) && c.diff > 0 && c.diff <= 3 && amountsMatch(b.amount, bookTxns[c.ri].amount))
      .sort((a, z) => a.diff - z.diff);
    if (cands.length) tryMatch(bi, cands[0].ri, 'near_date', { daysDiff: Math.round(cands[0].diff) });
  }
  // Pass 3: ±7 days + exact amount, ranked by description similarity
  for (let bi = 0; bi < bankTxns.length; bi++) {
    if (usedBank.has(bi)) continue;
    const b = bankTxns[bi];
    const cands = bookTxns
      .map((r, ri) => ({ ri, diff: daysDiff(b.date, r.date), sim: descSimilarity(b.desc, r.desc) }))
      .filter(c => !usedBook.has(c.ri) && c.diff > 3 && c.diff <= 7 && amountsMatch(b.amount, bookTxns[c.ri].amount))
      .sort((a, z) => (z.sim - a.sim) || (a.diff - z.diff));
    if (cands.length) tryMatch(bi, cands[0].ri, 'wide_date', { daysDiff: Math.round(cands[0].diff), simScore: Math.round(cands[0].sim * 100) });
  }
  // Pass 4: ±3 days + amount within tolerance
  for (let bi = 0; bi < bankTxns.length; bi++) {
    if (usedBank.has(bi)) continue;
    const b = bankTxns[bi];
    const cands = bookTxns
      .map((r, ri) => ({ ri, diff: daysDiff(b.date, r.date), amtDiff: Math.abs(Math.abs(b.amount) - Math.abs(r.amount)) }))
      .filter(c => !usedBook.has(c.ri) && c.diff <= 3 && amountsNear(b.amount, bookTxns[c.ri].amount))
      .sort((a, z) => a.amtDiff - z.amtDiff || a.diff - z.diff);
    if (cands.length) tryMatch(bi, cands[0].ri, 'near_amount', { daysDiff: Math.round(cands[0].diff), amtDiff: +cands[0].amtDiff.toFixed(2) });
  }

  return {
    matched,
    bankOnly: bankTxns.filter((_, i) => !usedBank.has(i)),
    bookOnly:  bookTxns.filter((_, i) => !usedBook.has(i)),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Test harness
// ══════════════════════════════════════════════════════════════════════════════

let passed = 0, failed = 0, warnings = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    passed++;
  } catch (e) {
    results.push({ name, status: 'FAIL', detail: e.message });
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''}: expected ${b}, got ${a}`); }
function assertNear(a, b, tol, msg) { if (Math.abs(a-b) > tol) throw new Error(`${msg || ''}: ${a} not within ${tol} of ${b}`); }

// ── Helpers ──────────────────────────────────────────────────────────────────

function tx(dateStr, amount, desc = '') {
  const date = parseDate(dateStr);
  if (!date) throw new Error(`Bad date in test helper: "${dateStr}"`);
  return { date, amount, desc };
}

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function randomAmount(min = 10, max = 10000) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function generatePaired(n, opts = {}) {
  // Returns { bankTxns, bookTxns, pairCount } where pairCount items are known matches
  const { dateJitter = 0, amtJitter = 0, descVariant = false } = opts;
  const bankTxns = [], bookTxns = [];
  const baseDate = new Date(2024, 0, 1);
  let pairCount = 0;

  for (let i = 0; i < n; i++) {
    const d = addDays(baseDate, Math.floor(Math.random() * 365));
    const amt = randomAmount();
    const desc = `PAYMENT REF${String(i).padStart(4,'0')}`;

    const bankDate = dateJitter ? addDays(d, Math.floor(Math.random() * dateJitter)) : d;
    const bookDate = d;
    const bankAmt  = amtJitter ? amt + (Math.random() - 0.5) * amtJitter : amt;
    const bookDesc = descVariant ? desc.replace('PAYMENT', 'PMT').replace('REF', 'Ref-') : desc;

    bankTxns.push({ date: bankDate, amount: -bankAmt, desc });
    bookTxns.push({ date: bookDate, amount: -amt, desc: bookDesc });
    pairCount++;
  }
  return { bankTxns, bookTxns, pairCount };
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Date parsing
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 1. Date Parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('ISO 8601: YYYY-MM-DD', () => {
  const d = parseDate('2024-03-15');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('US slash: MM/DD/YYYY', () => {
  const d = parseDate('3/15/2024');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('US slash zero-padded: 03/15/2024', () => {
  const d = parseDate('03/15/2024');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('Two-digit year: 3/15/24', () => {
  const d = parseDate('3/15/24');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('ISO with time: 2024-03-15T00:00:00', () => {
  const d = parseDate('2024-03-15T00:00:00');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('ISO with timezone: 2024-03-15T12:00:00Z', () => {
  const d = parseDate('2024-03-15T12:00:00Z');
  assert(d !== null, 'should not be null');
});
test('Word month: Jan 15, 2024', () => {
  const d = parseDate('Jan 15, 2024');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 0); assertEq(d.getDate(), 15);
});
test('Word month reversed: 15 Jan 2024', () => {
  const d = parseDate('15 Jan 2024');
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 0); assertEq(d.getDate(), 15);
});
test('Excel serial number (numeric type)', () => {
  const d = parseDate(45366); // 2024-03-15
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('Excel serial number (string type)', () => {
  const d = parseDate('45366'); // 2024-03-15
  assertEq(d.getFullYear(), 2024); assertEq(d.getMonth(), 2); assertEq(d.getDate(), 15);
});
test('Dash-separated: 2024-03-15', () => {
  const d = parseDate('2024-03-15');
  assertEq(d.getDate(), 15);
});
test('Null / empty return null', () => {
  assert(parseDate(null) === null);
  assert(parseDate('') === null);
  assert(parseDate(undefined) === null);
});
test('Garbage string returns null', () => {
  assert(parseDate('not a date') === null);
  assert(parseDate('N/A') === null);
});
test('Year 2000 dates parse correctly', () => {
  const d = parseDate('01/01/2000');
  assertEq(d.getFullYear(), 2000);
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Amount parsing
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 2. Amount Parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('Plain integer', () => assertEq(parseNum('1000'), 1000));
test('Decimal', () => assertEq(parseNum('1234.56'), 1234.56));
test('With comma separators', () => assertEq(parseNum('1,234.56'), 1234.56));
test('Negative', () => assertEq(parseNum('-500.00'), -500));
test('Parenthetical negative', () => assertEq(parseNum('(1,234.56)'), -1234.56));
test('With dollar sign', () => assertEq(parseNum('$1,234.56'), 1234.56));
test('Empty string → 0', () => assertEq(parseNum(''), 0));
test('Null → 0', () => assertEq(parseNum(null), 0));
test('Already a number', () => assertEq(parseNum(99.99), 99.99));
test('Zero', () => assertEq(parseNum('0.00'), 0));
test('Large amount', () => assertEq(parseNum('1,234,567.89'), 1234567.89));
test('No-digit garbage → 0', () => assertEq(parseNum('N/A'), 0));
test('Scientific notation', () => assertNear(parseNum('1.5e3'), 1500, 0.01));

// ══════════════════════════════════════════════════════════════════════════════
// 3. Column detection
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 3. Column Detection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('Standard bank CSV headers', () => {
  const c = detectCols(['Date', 'Description', 'Withdrawals', 'Deposits', 'Balance']);
  assertEq(c.date, 0); assertEq(c.desc, 1); assertEq(c.debit, 2); assertEq(c.credit, 3); assertEq(c.balance, 4);
});
test('QuickBooks register headers', () => {
  const c = detectCols(['Date', 'Transaction Type', 'Num', 'Name', 'Memo', 'Debit', 'Credit', 'Balance']);
  assertEq(c.date, 0); assertEq(c.debit, 5); assertEq(c.credit, 6);
});
test('Single amount column', () => {
  const c = detectCols(['Date', 'Payee', 'Amount']);
  assertEq(c.amount, 2); assertEq(c.debit, -1); assertEq(c.credit, -1);
});
test('Debit/credit preferred over amount', () => {
  const c = detectCols(['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Balance']);
  assertEq(c.debit, 2); assertEq(c.credit, 3);
  assertEq(c.amount, -1, 'amount col should be suppressed when debit/credit exist');
});
test('Post Date column name', () => {
  const c = detectCols(['Post Date', 'Description', 'Amount']);
  assertEq(c.date, 0);
});
test('Transaction Date column name', () => {
  const c = detectCols(['Transaction Date', 'Memo', 'Debit', 'Credit']);
  assertEq(c.date, 0);
});
test('Payee desc column', () => {
  const c = detectCols(['Date', 'Payee', 'Amount']);
  assertEq(c.desc, 1);
});
test('Narration desc column', () => {
  const c = detectCols(['Date', 'Narration', 'DR', 'CR']);
  assertEq(c.desc, 1);
});
test('Missing date returns -1', () => {
  const c = detectCols(['Company', 'Amount', 'Reference']);
  assertEq(c.date, -1);
});
test('DR/CR shorthand columns', () => {
  const c = detectCols(['Date', 'Details', 'DR', 'CR', 'Balance']);
  assertEq(c.debit, 2); assertEq(c.credit, 3);
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Matching accuracy
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 4. Matching Accuracy ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('Empty bank and book → 0 matched', () => {
  const { matched, bankOnly, bookOnly } = matchTxns([], []);
  assertEq(matched.length, 0); assertEq(bankOnly.length, 0); assertEq(bookOnly.length, 0);
});
test('Empty bank, non-empty book → all book-only', () => {
  const book = [tx('2024-01-05', -500, 'Rent'), tx('2024-01-10', -200, 'Electric')];
  const { matched, bankOnly, bookOnly } = matchTxns([], book);
  assertEq(matched.length, 0); assertEq(bookOnly.length, 2);
});
test('Non-empty bank, empty book → all bank-only', () => {
  const bank = [tx('2024-01-05', -500, 'Rent'), tx('2024-01-10', -200, 'Electric')];
  const { matched, bankOnly, bookOnly } = matchTxns(bank, []);
  assertEq(matched.length, 0); assertEq(bankOnly.length, 2);
});
test('Single exact match', () => {
  const bank = [tx('2024-01-15', -1247.83, 'ACH PAYMENT')];
  const book = [tx('2024-01-15', -1247.83, 'ACH Payment')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1); assertEq(matched[0].confidence, 'exact');
});
test('100 exact matches', () => {
  const { bankTxns, bookTxns, pairCount } = generatePaired(100, { dateJitter: 0 });
  const { matched } = matchTxns(bankTxns, bookTxns);
  assertEq(matched.length, pairCount, '100 pairs should all match');
  assert(matched.every(m => m.confidence === 'exact'), 'all should be exact matches');
});
test('1-day date jitter (near_date)', () => {
  const bank = [tx('2024-01-16', -500, 'CHECK 1042')];
  const book = [tx('2024-01-15', -500, 'CHECK 1042')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1); assertEq(matched[0].confidence, 'near_date');
});
test('3-day date jitter (near_date boundary)', () => {
  const bank = [tx('2024-01-18', -750, 'Vendor payment')];
  const book = [tx('2024-01-15', -750, 'Vendor payment')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1);
});
test('4-day date jitter → wide_date pass', () => {
  const bank = [tx('2024-01-19', -750, 'Vendor payment')];
  const book = [tx('2024-01-15', -750, 'Vendor payment')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1); assertEq(matched[0].confidence, 'wide_date');
});
test('8-day date jitter → no match', () => {
  const bank = [tx('2024-01-23', -750, 'Vendor')];
  const book = [tx('2024-01-15', -750, 'Vendor')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 0, 'Should not match with 8-day gap');
});
test('Amount tolerance: $0.30 off (within $0.50)', () => {
  const bank = [tx('2024-01-15', -1000.30, 'Amazon')];
  const book = [tx('2024-01-15', -1000.00, 'Amazon')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1); assertEq(matched[0].confidence, 'near_amount');
});
test('Amount tolerance: 0.8% off (within 1%)', () => {
  const bank = [tx('2024-01-15', -5040, 'Payroll')];
  const book = [tx('2024-01-15', -5000, 'Payroll')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1); assertEq(matched[0].confidence, 'near_amount');
});
test('Amount tolerance: 5% off (outside tolerance)', () => {
  const bank = [tx('2024-01-15', -5250, 'Payroll')];
  const book = [tx('2024-01-15', -5000, 'Payroll')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 0, 'Large amount discrepancy should not match');
});
test('Duplicate amounts same date: greedy but deterministic', () => {
  const bank = [tx('2024-01-15', -500, 'Payment A'), tx('2024-01-15', -500, 'Payment B')];
  const book = [tx('2024-01-15', -500, 'Invoice 1'), tx('2024-01-15', -500, 'Invoice 2')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 2, 'Both $500 payments should match (greedy pairing)');
});
test('No false positives: different amounts same date', () => {
  const bank = [tx('2024-01-15', -500)];
  const book = [tx('2024-01-15', -600)];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 0);
});
test('No false positives: same amount very different dates', () => {
  const bank = [tx('2024-01-01', -500)];
  const book = [tx('2024-06-01', -500)];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 0);
});
test('Deposits (positive amounts) match correctly', () => {
  const bank = [tx('2024-01-20', 3500, 'CLIENT PAYMENT')];
  const book = [tx('2024-01-20', 3500, 'Client payment received')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1);
});
test('Sign convention: bank negative, book positive same abs amount → match', () => {
  // Bank records outflow as negative; some book exports record same as positive debit
  const bank = [tx('2024-01-15', -1000, 'Payment')];
  const book = [tx('2024-01-15',  1000, 'Payment')]; // recorded as debit (positive) in books
  const { matched } = matchTxns(bank, book);
  // amountsMatch compares absolute values, so this SHOULD match
  assertEq(matched.length, 1, 'Should match on absolute amount regardless of sign');
});
test('Month boundary: Jan 31 bank, Feb 1 book', () => {
  const bank = [tx('2024-01-31', -2500, 'ACH Payroll')];
  const book = [tx('2024-02-01', -2500, 'ACH Payroll')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1, 'Month-boundary timing difference should still match');
});
test('All bank-only (no overlap in dates or amounts)', () => {
  const bank = [tx('2024-01-05', -100), tx('2024-01-10', -200)];
  const book = [tx('2024-03-05', -999), tx('2024-03-10', -888)];
  const { matched, bankOnly, bookOnly } = matchTxns(bank, book);
  assertEq(matched.length, 0);
  assertEq(bankOnly.length, 2);
  assertEq(bookOnly.length, 2);
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Description similarity
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 5. Description Similarity ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('Identical descriptions → sim = 1.0', () => {
  assertEq(descSimilarity('AMAZON PAYMENT', 'AMAZON PAYMENT'), 1.0);
});
test('Completely different → sim = 0', () => {
  assertEq(descSimilarity('AMAZON PAYMENT', 'ELECTRIC BILL'), 0);
});
test('Partial overlap', () => {
  const s = descSimilarity('AMAZON MARKETPLACE', 'AMAZON WEB SERVICES');
  assert(s > 0 && s < 1, `Expected 0 < sim < 1, got ${s}`);
});
test('Empty description → 0', () => {
  assertEq(descSimilarity('', 'AMAZON'), 0);
  assertEq(descSimilarity('AMAZON', ''), 0);
});
test('Prefix matching boosts score', () => {
  // 'depos' is a prefix of 'deposit' — should get partial credit
  const s = descSimilarity('depos ref123', 'deposit ref123');
  assert(s > 0.5, `Expected prefix match to boost score, got ${s}`);
});
test('Wide-date pass catches same amount with description hint', () => {
  // 5-day gap, exact amount, non-zero description similarity
  const bank = [tx('2024-01-20', -2500, 'RENT JAN 2024')];
  const book = [tx('2024-01-15', -2500, 'January 2024 rent')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1, 'Wide date pass should catch this');
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. Performance (stress tests)
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 6. Performance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

function perfTest(label, n, maxMs) {
  test(`${label} (n=${n}) completes under ${maxMs}ms`, () => {
    const { bankTxns, bookTxns } = generatePaired(n, { dateJitter: 2 });
    const t0 = Date.now();
    const { matched } = matchTxns(bankTxns, bookTxns);
    const elapsed = Date.now() - t0;
    assert(elapsed < maxMs, `Took ${elapsed}ms, exceeded ${maxMs}ms limit`);
    assert(matched.length > 0, 'Should have at least some matches');
    results[results.length - 1].detail = `${elapsed}ms, ${matched.length}/${n} matched`;
  });
}

perfTest('Small dataset',  100,  100);
perfTest('Medium dataset', 500,  500);
perfTest('Large dataset',  1000, 3000);

test('2000 transactions: passes and bankOnly+bookOnly add up', () => {
  const n = 2000;
  const { bankTxns, bookTxns } = generatePaired(n, { dateJitter: 1 });
  // Add 100 bank-only and 100 book-only items
  const extraDate = new Date(2025, 0, 1);
  for (let i = 0; i < 100; i++) {
    bankTxns.push({ date: addDays(extraDate, i), amount: -(i+1) * 7.77, desc: `BANK ONLY ${i}` });
    bookTxns.push({ date: addDays(extraDate, i), amount: -(i+1) * 6.66, desc: `BOOK ONLY ${i}` });
  }
  const t0 = Date.now();
  const { matched, bankOnly, bookOnly } = matchTxns(bankTxns, bookTxns);
  const elapsed = Date.now() - t0;
  assertEq(matched.length + bankOnly.length, bankTxns.length, 'bank totals must balance');
  assertEq(matched.length + bookOnly.length, bookTxns.length, 'book totals must balance');
  results[results.length - 1].detail = `${elapsed}ms, ${matched.length} matched, ${bankOnly.length} bank-only, ${bookOnly.length} book-only`;
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Edge cases
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━━ 7. Edge Cases ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

test('Zero-amount transaction: no crash, amount=0 can appear', () => {
  // These would be filtered in extractTxns, but matchTxns itself should handle them
  const bank = [{ date: new Date(2024,0,15), amount: 0, desc: 'Zero txn' }];
  const book = [{ date: new Date(2024,0,15), amount: 0, desc: 'Zero txn' }];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1, 'Two zero amounts on same date match each other');
});
test('Very large amounts match correctly', () => {
  const bank = [tx('2024-01-15', -1234567.89, 'Wire Transfer')];
  const book = [tx('2024-01-15', -1234567.89, 'Wire Transfer')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1);
});
test('Single-cent amount', () => {
  const bank = [tx('2024-01-15', -0.01, 'Micro payment')];
  const book = [tx('2024-01-15', -0.01, 'Micro payment')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1);
});
test('All same amount different dates: only date-adjacent ones match', () => {
  const bank = Array.from({length: 12}, (_, i) => tx(`2024-${String(i+1).padStart(2,'0')}-01`, -1000, 'Rent'));
  const book = Array.from({length: 12}, (_, i) => tx(`2024-${String(i+1).padStart(2,'0')}-02`, -1000, 'Rent')); // 1 day later
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 12, 'Monthly rent should all match across month boundaries with 1-day jitter');
});
test('Transactions with special chars in description', () => {
  const bank = [tx('2024-01-15', -99.99, 'PAY TO: Smith & Sons, LLC / REF#12345')];
  const book = [tx('2024-01-15', -99.99, 'Smith & Sons')];
  // amount matches exactly, date matches exactly — should match in Pass 1
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1);
});
test('parseDate handles JS Date object passthrough', () => {
  const d = new Date(2024, 2, 15);
  // parseDate gets a Date object value from some code paths?
  // It should not crash
  const result = parseDate(d.toISOString());
  assert(result !== null);
});
test('No double-counting: one bank txn can only match one book txn', () => {
  const bank = [tx('2024-01-15', -500, 'Payment')];
  const book = [tx('2024-01-15', -500, 'Payment'), tx('2024-01-16', -500, 'Payment')]; // two candidates
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 1, 'One bank txn should only match one book txn');
});
test('No double-counting: one book txn can only match one bank txn', () => {
  const bank = [tx('2024-01-15', -500, 'A'), tx('2024-01-16', -500, 'B')];
  const book = [tx('2024-01-15', -500, 'C')]; // one book entry, two bank candidates
  const { matched, bankOnly } = matchTxns(bank, book);
  assertEq(matched.length, 1, 'One book txn matches only once');
  assertEq(bankOnly.length, 1, 'Other bank txn is bank-only');
});
test('Mixed positive and negative: deposits vs payments distinguished', () => {
  const bank = [tx('2024-01-15', 1000, 'Deposit'), tx('2024-01-15', -1000, 'Payment')];
  const book = [tx('2024-01-15',  1000, 'Deposit'), tx('2024-01-15', -1000, 'Payment')];
  const { matched } = matchTxns(bank, book);
  assertEq(matched.length, 2);
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(68));
console.log(`  Results: ${passed} passed  ${failed} failed  (${passed + failed} total)`);
console.log('═'.repeat(68));

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => {
    console.log(`  ✗  ${r.name}`);
    if (r.detail) console.log(`     → ${r.detail}`);
  });
}

const perfResults = results.filter(r => r.detail && r.detail.includes('ms'));
if (perfResults.length) {
  console.log('\nPerformance results:');
  perfResults.forEach(r => console.log(`  ⏱  ${r.name}: ${r.detail}`));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
