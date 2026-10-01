const { chromium } = require('playwright');
const URL = 'file:///home/user/sandvalleyvatoz/index.html';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS  ' + m)) : (fail++, console.log('  FAIL  ' + m)); };

// In-memory stand-in for the repo file, so we can exercise read/write/409 without a token.
function makeRepo() {
  return { file: null, sha: null, puts: [], commits: [] };
}
async function mockApi(page, repo, opts = {}) {
  await page.route('https://api.github.com/**', async route => {
    const req = route.request();
    if (opts.offline) return route.abort('failed');
    if (req.method() === 'GET') {
      // Faithful to GitHub's real 403 body. The x-ratelimit-remaining header is
      // deliberately NOT set here: it is CORS-filtered in a real browser, which
      // is exactly why the code must fall back to reading the body message.
      if (opts.rateLimit) return route.fulfill({ status: 403, contentType: 'application/json',
        body: JSON.stringify({ message: "API rate limit exceeded for 203.0.113.7. (But here's the good news: Authenticated requests get a higher rate limit.)",
                               documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting' }) });
      if (repo.file === null) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ sha: repo.sha, content: Buffer.from(repo.file, 'utf8').toString('base64') }) });
    }
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      repo.puts.push(body);
      if (opts.staleOnce && !repo._bumped) { repo._bumped = true; return route.fulfill({ status: 409, body: '{}' }); }
      if (body.sha && body.sha !== repo.sha) return route.fulfill({ status: 409, body: '{}' });
      repo.file = Buffer.from(body.content, 'base64').toString('utf8');
      repo.sha = 'sha' + (repo.commits.length + 1);
      repo.commits.push(body.message);
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: { sha: repo.sha } }) });
    }
    return route.fulfill({ status: 400, body: '{}' });
  });
}
const newPage = async (browser, token) => {
  const ctx = await browser.newContext();
  if (token) await ctx.addInitScript(t => localStorage.setItem('copa_token', t), token);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  page.errs = errs;
  return page;
};
const settle = p => p.waitForTimeout(600);
const tabs = p => p.$$eval('nav button', bs => bs.filter(b => !b.classList.contains('hide')).map(b => b.dataset.v));
const sync = p => p.$eval('#syncTxt', e => e.textContent);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  // ---- 1. Viewer, nothing published yet -------------------------------------
  console.log('\n[1] Viewer, no board published');
  let repo = makeRepo();
  let p = await newPage(browser);
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  ok(JSON.stringify(await tabs(p)) === '["info","today","stand","pair"]', 'Enter hidden for viewer; Pairings present read-only');
  ok(await p.$eval('#pubBtn', e => e.classList.contains('hide')), 'Publish button hidden for viewer');
  ok(/No board published yet/.test(await sync(p)), 'header says no board published: "' + await sync(p) + '"');
  ok(await p.$eval('#v-stand', e => true).catch(() => false), 'Standings section exists');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 2. Editor publishes --------------------------------------------------
  console.log('\n[2] Editor enters a score and publishes');
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  ok(JSON.stringify(await tabs(p)) === '["info","today","enter","stand","pair"]', 'all five tabs for editor');
  ok(!(await p.$eval('#pubBtn', e => e.classList.contains('hide'))), 'Publish button visible for editor');

  await p.click('nav button[data-v="enter"]'); await p.waitForTimeout(250);
  await p.fill('[data-pts="0"]', '38'); await p.waitForTimeout(250);
  ok(/Unpublished changes/.test(await sync(p)), 'header flags unpublished edits: "' + await sync(p) + '"');

  await p.click('#pubBtn'); await settle(p);
  ok(repo.commits.length === 1, 'exactly one commit created (got ' + repo.commits.length + ')');
  ok(/Updated just now/.test(await sync(p)), 'header shows freshly published: "' + await sync(p) + '"');
  const saved = JSON.parse(repo.file);
  ok(saved.s.r1 && saved.s.r1[0] === 38, 'published payload carries the score');
  ok(typeof saved.m === 'number' && saved.m > 0, 'published payload carries a timestamp');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));

  // typing more should not commit on its own
  await p.fill('[data-pts="1"]', '31'); await p.waitForTimeout(400);
  ok(repo.commits.length === 1, 'typing does NOT auto-commit (still ' + repo.commits.length + ')');
  await p.context().close();

  // ---- 3. Viewer sees the published board ----------------------------------
  console.log('\n[3] Viewer refreshes and sees it');
  p = await newPage(browser);
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  const seen = await p.evaluate(() => S.s.r1 ? S.s.r1[0] : null);
  ok(seen === 38, 'viewer pulled the published score (got ' + seen + ')');
  ok(/Updated/.test(await sync(p)), 'viewer sees last-updated: "' + await sync(p) + '"');
  ok(JSON.stringify(await tabs(p)) === '["info","today","stand","pair"]', 'still no Enter tab');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 4. Stale SHA -> 409 -> refetch and retry ----------------------------
  console.log('\n[4] Stale SHA retry');
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, repo, { staleOnce: true });
  await p.goto(URL); await settle(p);
  await p.click('nav button[data-v="enter"]'); await p.waitForTimeout(250);
  await p.fill('[data-pts="2"]', '40'); await p.waitForTimeout(200);
  const before = repo.commits.length;
  await p.click('#pubBtn'); await settle(p);
  ok(repo.commits.length === before + 1, 'recovered from 409 and committed (' + before + '->' + repo.commits.length + ')');
  ok(/Updated just now/.test(await sync(p)), 'header recovered: "' + await sync(p) + '"');
  await p.context().close();

  // ---- 5. Rate limit is reported, board still renders -----------------------
  console.log('\n[5] Rate limited');
  p = await newPage(browser);
  await mockApi(p, repo, { rateLimit: true });
  await p.goto(URL); await settle(p);
  ok(/rate limit/i.test(await sync(p)), 'rate limit reported plainly: "' + await sync(p) + '"');
  ok(await p.$eval('#v-info', e => e.innerHTML.length > 500), 'board still renders while rate limited');
  await p.context().close();

  // ---- 6. Offline: hash still works, no data loss --------------------------
  console.log('\n[6] Offline editor');
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, repo, { offline: true });
  await p.goto(URL); await settle(p);
  await p.click('nav button[data-v="enter"]'); await p.waitForTimeout(250);
  await p.fill('[data-pts="3"]', '35'); await p.waitForTimeout(300);
  const hashHas = await p.evaluate(() => {
    const o = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
    return o.s.r1 ? o.s.r1[3] : null;
  });
  ok(hashHas === 35, 'edit persisted to URL hash with no network (got ' + hashHas + ')');
  await p.click('#pubBtn'); await settle(p);
  ok(/fail/i.test(await sync(p)), 'publish failure surfaced: "' + await sync(p) + '"');
  const stillThere = await p.evaluate(() => S.s.r1[3]);
  ok(stillThere === 35, 'score NOT lost after a failed publish');
  await p.context().close();

  // ---- 7. Pairing invariants unchanged -------------------------------------
  console.log('\n[7] Pairing invariants still hold');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  const inv = await p.evaluate(() => {
    const N = P.map(x => x.n), k = (a, b) => Math.min(a, b) + '|' + Math.max(a, b), h = {};
    R.forEach(rd => { if (rd.id === 'r3' || rd.id === 'r8') return; const g = S.p[rd.id]; if (!g) return;
      g.forEach(x => { for (let a = 0; a < x.length; a++) for (let b = a + 1; b < x.length; b++) h[k(x[a], x[b])] = (h[k(x[a], x[b])] || 0) + 1; }); });
    const z = []; for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) if (!h[k(i, j)]) z.push(N[i] + '/' + N[j]);
    const four = []; Object.keys(h).forEach(key => { if (h[key] > 3) { const [a, b] = key.split('|'); four.push(N[a] + '/' + N[b]); } });
    return { met: Object.keys(h).length, max: Math.max(...Object.values(h)), zero: z.length, zeros: z.sort().join(','), fours: four.sort().join(','),
      md: h[k(N.indexOf('Matt'), N.indexOf('Daniel'))] || 0, dp: h[k(N.indexOf('Drew'), N.indexOf('Paul'))] || 0,
      r5: sitOuts(R.find(r => r.id === 'r5')).map(i => N[i]).join(), r7: sitOuts(R.find(r => r.id === 'r7')).map(i => N[i]).join() };
  });
  /* Full coverage became impossible when Wednesday was fixed by tee times (Lido at
     10:00 for Brook/Tony/Eric/Ryan, one Sedge and one Sand Valley foursome) — see
     CLAUDE.md §3. These pin the accepted gaps exactly, so any NEW gap still fails. */
  ok(inv.zeros === 'Drew/Ryan', 'only the accepted pairs never meet (got ' + inv.zeros + ')');
  ok(inv.fours === 'Brook/Eric' && inv.max === 4, 'only the accepted pairs meet 4 times (got ' + inv.fours + ')');
  ok(inv.md >= 2, 'Matt+Daniel ' + inv.md + ' >= 2');
  ok(inv.dp >= 2, 'Drew+Paul ' + inv.dp + ' >= 2');
  ok(inv.r5 === 'Drew' && inv.r7 === 'Mike,Tony,Brook,Eric,Ryan', 'sit-outs intact (r5 ' + inv.r5 + ', r7 ' + inv.r7 + ')');

  await p.context().close();

  // ---- 8. Handicap indexes: edit, recalc, publish, propagate ---------------
  console.log('\n[8] Handicap indexes');
  repo = makeRepo();
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(300);

  const before8 = await p.evaluate(() => ({
    idx: P[0].idx,
    quota: quotaFor(P[0].idx, teeFor(R[1], 0)),
    commons: commonsHcp(P[0].idx)
  }));
  ok(before8.idx === 13, 'Matt starts on the placeholder 13 (got ' + before8.idx + ')');

  await p.fill('[data-idx="0"]', '9');
  await p.dispatchEvent('[data-idx="0"]', 'change');
  await p.waitForTimeout(350);

  const after8 = await p.evaluate(() => ({
    idx: P[0].idx,
    quota: quotaFor(P[0].idx, teeFor(R[1], 0)),
    commons: commonsHcp(P[0].idx),
    stateVal: S.i[0],
    others: P.slice(1).map(x => x.idx)
  }));
  ok(after8.idx === 9, 'roster index updated to 9 (got ' + after8.idx + ')');
  ok(after8.stateVal === 9, 'stored in S.i for publishing (got ' + after8.stateVal + ')');
  // Quota does NOT track the index 1:1 — slope scales it. Woodlands Blue is
  // 71.6/131 par 72, so 13->9 is 4 index strokes but 4.6 course-handicap
  // strokes, which rounds to 5. Check against the formula, not a guessed delta.
  const expect8 = await p.evaluate(() => {
    const t = teeFor(R[1], 0);
    return { at13: 36 - Math.round(13 * t[2] / 113 + (t[1] - t[3])),
             at9:  36 - Math.round(9  * t[2] / 113 + (t[1] - t[3])) };
  });
  ok(before8.quota === expect8.at13 && after8.quota === expect8.at9,
     'quota tracks the index through slope (' + before8.quota + '->' + after8.quota + ', expected ' + expect8.at13 + '->' + expect8.at9 + ')');
  ok(after8.commons !== before8.commons, 'Commons 65% handicap recalculated (' + before8.commons + '->' + after8.commons + ')');
  ok(JSON.stringify(after8.others) === JSON.stringify([7, 6, 13, 12, 10, 14, 8, 9]), 'other eight untouched');

  await p.click('#pubBtn'); await settle(p);
  ok(JSON.parse(repo.file).i['0'] === 9, 'index reached the published payload');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));

  // one decimal place: real indexes look like 7.4
  const attrs8 = await p.evaluate(() => {
    const el = document.querySelector('[data-idx="1"]');
    return { inputmode: el.getAttribute('inputmode'), step: el.getAttribute('step'), type: el.type };
  });
  ok(attrs8.step === '0.1', 'input step is 0.1 (got ' + attrs8.step + ')');
  ok(attrs8.inputmode === 'decimal', 'inputmode is decimal so phones show a decimal point (got ' + attrs8.inputmode + ')');

  await p.fill('[data-idx="1"]', '7.4'); await p.dispatchEvent('[data-idx="1"]', 'change');
  await p.waitForTimeout(300);
  const dec8 = await p.evaluate(() => ({
    idx: P[1].idx, stored: S.i[1],
    shown: document.querySelector('[data-idx="1"]').value,
    quota: quotaFor(P[1].idx, teeFor(R[1], 1)),
    expect: 36 - Math.round(7.4 * teeFor(R[1],1)[2] / 113 + (teeFor(R[1],1)[1] - teeFor(R[1],1)[3]))
  }));
  ok(dec8.idx === 7.4 && dec8.stored === 7.4, 'a decimal index is kept exactly (got ' + dec8.idx + ')');
  ok(dec8.shown === '7.4', 'field redisplays 7.4 after re-render (got "' + dec8.shown + '")');

  // indexes pad to one decimal everywhere; anything derived stays integer
  const pad = await p.evaluate(() => {
    const grab = sel => (document.querySelector(sel) || {}).textContent || '';
    return {
      // Mike is on the placeholder 6 -> must render "6.0"
      pairRow: [...document.querySelectorAll('#v-pair .asgn span i')].map(x => x.textContent),
      roIdx: (() => { const c = rosterCardReadOnly(); const m = c.match(/<td>([\d.\-]+)<\/td><td><b>(\d+)<\/b>/); return m ? { idx: m[1], commons: m[2] } : null; })(),
      chcpInt: Number.isInteger(chcp(7.4, teeFor(R[1], 1))),
      commonsInt: Number.isInteger(commonsHcp(7.4)),
      quotaInt: Number.isInteger(quotaFor(7.4, teeFor(R[1], 1)))
    };
  });
  // Two kinds of <i> live on this tab: the assignment rows show a bare index,
  // the roster editor shows "was N.N" or "placeholder". All must be padded.
  const badPad = pad.pairRow.filter(t => !(t === 'placeholder' || /^(was )?-?\d+\.\d$/.test(t)));
  ok(badPad.length === 0, 'every index on the Pairings tab is padded to 1dp' + (badPad.length ? ', unpadded: ' + JSON.stringify(badPad) : ''));
  ok(pad.roIdx && /^-?\d+\.\d$/.test(pad.roIdx.idx), 'read-only index table padded to 1dp (got ' + JSON.stringify(pad.roIdx) + ')');
  ok(pad.roIdx && /^\d+$/.test(pad.roIdx.commons), 'Commons handicap has no decimals (got ' + (pad.roIdx || {}).commons + ')');
  ok(pad.chcpInt && pad.commonsInt && pad.quotaInt,
     'course handicap, Commons and quota stay integers off a decimal index');

  // and across the other tabs
  for (const [tab, sel] of [['today', '#v-today'], ['enter', '#v-enter'], ['stand', '#v-stand']]) {
    await p.click(`nav button[data-v="${tab}"]`); await p.waitForTimeout(250);
    const bare = await p.evaluate(s => {
      const txt = document.querySelector(s).textContent;
      // an index written without a decimal, e.g. "index 7 ·" or "idx 12<"
      return (txt.match(/\bind?e?x? \d+(?!\.\d)\b/g) || []);
    }, sel);
    ok(bare.length === 0, tab + ' tab shows no unpadded index' + (bare.length ? ': ' + JSON.stringify(bare) : ''));
  }
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(250);
  ok(dec8.quota === dec8.expect, 'quota computed from the decimal index (got ' + dec8.quota + ', expected ' + dec8.expect + ')');

  // more than one decimal rounds rather than being rejected
  await p.fill('[data-idx="1"]', '7.43'); await p.dispatchEvent('[data-idx="1"]', 'change');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => P[1].idx === 7.4), 'extra decimals round to one place');

  // plus handicaps are negative; out-of-range values clamp
  await p.fill('[data-idx="1"]', '-2.3'); await p.dispatchEvent('[data-idx="1"]', 'change');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => P[1].idx === -2.3), 'plus handicap (negative index) accepted');
  await p.fill('[data-idx="1"]', '999'); await p.dispatchEvent('[data-idx="1"]', 'change');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => P[1].idx === 54), 'absurd value clamps to 54');
  await p.fill('[data-idx="1"]', '7'); await p.dispatchEvent('[data-idx="1"]', 'change');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => P[1].idx === 7 && S.i[1] === undefined), 'back to the placeholder value clears the override');

  // reset returns to the baked-in placeholders
  await p.click('#idxReset'); await p.waitForTimeout(350);
  const reset8 = await p.evaluate(() => ({ idx: P[0].idx, keys: Object.keys(S.i).length }));
  ok(reset8.idx === 13 && reset8.keys === 0, 'reset restores placeholders and clears S.i');
  await p.context().close();

  // ---- 9. Viewers receive published indexes --------------------------------
  console.log('\n[9] Viewer picks up published indexes');
  repo = makeRepo();
  repo.file = JSON.stringify({ v: 1, s: {}, t: {}, p: {}, o: {}, u: {}, i: { 0: 9, 6: 11 }, m: Date.now(), l: [] });
  repo.sha = 'sha1';
  p = await newPage(browser);
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  const v9 = await p.evaluate(() => ({ matt: P[0].idx, ryan: P[6].idx, mike: P[2].idx }));
  ok(v9.matt === 9 && v9.ryan === 11, 'viewer sees published indexes (Matt ' + v9.matt + ', Ryan ' + v9.ryan + ')');
  ok(v9.mike === 6, 'unpublished players keep placeholders (Mike ' + v9.mike + ')');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 10. Old links without the i key still work --------------------------
  console.log('\n[10] Backward compatibility');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  const legacy = Buffer.from(JSON.stringify({ v: 1, s: { r2: [30, null, null, null, null, null, null, null, null] }, t: {}, p: {}, o: {}, u: {}, l: [] }), 'utf8').toString('base64').replace(/=+$/, '');
  await p.goto(URL + '#' + legacy); await settle(p);
  const l10 = await p.evaluate(() => ({ idx: P.map(x => x.idx), score: S.s.r2 ? S.s.r2[0] : null, hasI: !!S.i }));
  ok(JSON.stringify(l10.idx) === JSON.stringify([13, 7, 6, 13, 12, 10, 14, 8, 9]), 'legacy link falls back to placeholders');
  ok(l10.score === 30, 'legacy link keeps its scores');
  ok(l10.hasI, 'missing i key is backfilled');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 11. Baseline pairings are not frozen into the published board -------
  console.log('\n[11] Baseline grid stays code-supplied');
  repo = makeRepo();
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, repo);
  await p.goto(URL); await settle(p);
  await p.click('#pubBtn'); await settle(p);
  let payload = JSON.parse(repo.file);
  ok(Object.keys(payload.p).length === 0, 'untouched baseline rounds omitted from publish (got ' + JSON.stringify(Object.keys(payload.p)) + ')');

  // hand-edit one round; that one SHOULD be published
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(300);
  await p.selectOption('[data-asg="0"]', '-1'); await p.waitForTimeout(300);
  await p.click('#pubBtn'); await settle(p);
  payload = JSON.parse(repo.file);
  ok(Object.keys(payload.p).length === 1, 'hand-edited round IS published (got ' + JSON.stringify(Object.keys(payload.p)) + ')');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // a client on a NEWER code grid must not inherit a stale published grid
  p = await newPage(browser);
  await mockApi(p, { file: JSON.stringify({ v:1, s:{}, t:{}, p:{}, o:{}, u:{}, i:{}, m: Date.now(), l:[] }), sha:'s1', puts:[], commits:[] });
  await p.goto(URL); await settle(p);
  const g11 = await p.evaluate(() => {
    const N = P.map(x => x.n);
    return { r7: S.p.r7.map(g => g.map(i => N[i]).sort().join('/')).sort().join(' | '),
             sit: sitOuts(R.find(r => r.id === 'r7')).map(i => N[i]).join() };
  });
  ok(g11.sit === 'Mike,Tony,Brook,Eric,Ryan', 'r7 sit-out comes from code, not the published file (got ' + g11.sit + ')');
  ok(g11.r7 === 'Daniel/Drew/Matt/Paul', 'r7 groups are the current code grid (got ' + g11.r7 + ')');
  await p.context().close();

  // ---- 12. Pairings tab is read-only for viewers, editable for the organiser
  console.log('\n[12] Read-only Pairings for viewers');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  ok(JSON.stringify(await tabs(p)) === '["info","today","stand","pair"]', 'viewer now sees Pairings, still no Enter');
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(300);
  const ro = await p.evaluate(() => ({
    heads: [...document.querySelectorAll('#v-pair h2')].map(x => x.textContent),
    inputs: document.querySelectorAll('#v-pair input, #v-pair select, #v-pair button').length,
    oldName: /Who has played with whom/.test(document.querySelector('#v-pair').innerHTML),
    rselHidden: document.querySelector('.rsel').classList.contains('hide'),
    showsIdx: /\b13\b/.test(document.querySelector('#v-pair').innerHTML)
  }));
  ok(JSON.stringify(ro.heads) === '["Who plays with whom","Handicap indexes","Courses by player"]', 'exactly the three viewer cards: ' + JSON.stringify(ro.heads));
  ok(ro.inputs === 0, 'no inputs, selects or buttons for a viewer (found ' + ro.inputs + ')');
  ok(!ro.oldName, 'old "Who has played with whom" wording is gone');
  ok(ro.showsIdx, 'viewer can still read the index values');
  ok(ro.rselHidden, 'round selector hidden (both cards are round-independent)');
  // The "How pairings work" card describes organiser-only controls.
  await p.click('nav button[data-v="info"]'); await p.waitForTimeout(250);
  const infoV = await p.evaluate(() => [...document.querySelectorAll('#v-info .card h2')].map(x => x.textContent));
  ok(!infoV.includes('How pairings work'), 'viewer does not get the pairings-mechanics card');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // organiser keeps the full editable tab
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(300);
  const ed12 = await p.evaluate(() => ({
    heads: [...document.querySelectorAll('#v-pair h2')].map(x => x.textContent),
    idxInputs: document.querySelectorAll('#v-pair [data-idx]').length,
    asgSelects: document.querySelectorAll('#v-pair [data-asg]').length,
    rselHidden: document.querySelector('.rsel').classList.contains('hide')
  }));
  ok(ed12.idxInputs === 9, 'organiser still has nine editable index fields (got ' + ed12.idxInputs + ')');
  ok(ed12.asgSelects === 9, 'organiser still has the assignment dropdowns (got ' + ed12.asgSelects + ')');
  ok(ed12.heads.includes('Who plays with whom'), 'organiser matrix also renamed: ' + JSON.stringify(ed12.heads));
  ok(!ed12.rselHidden, 'round selector visible for the organiser');

  await p.click('nav button[data-v="info"]'); await p.waitForTimeout(250);
  const infoE = await p.evaluate(() => ({
    cards: [...document.querySelectorAll('#v-info .card h2')].map(x => x.textContent),
    count: (document.querySelector('#v-info').innerText.match(/The (\d+) grouped rounds/) || [])[1]
  }));
  ok(infoE.cards.includes('How pairings work'), 'organiser does get the pairings-mechanics card');
  ok(infoE.count === '6', 'grouped-round count is derived from BASE_GRID (got ' + infoE.count + ')');
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(250);

  // and the index edit still works end to end
  await p.fill('[data-idx="2"]', '4'); await p.dispatchEvent('[data-idx="2"]', 'change');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => P[2].idx === 4 && S.i[2] === 4), 'organiser edit still applies');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 13. Lawsonia as a conditional backup round ---------------------------
  console.log('\n[13] Lawsonia backs up a short Sand Valley pool');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);

  const cfg = await p.evaluate(() => ({ counting: COUNTING, backup: BACKUP, min: MIN_POOL }));
  ok(JSON.stringify(cfg.counting) === '["r2","r4","r5","r6","r7"]', 'five Sand Valley counting rounds: ' + cfg.counting.join(','));
  ok(JSON.stringify(cfg.backup) === '["r1"]', 'Lawsonia Links is the only backup: ' + cfg.backup.join(','));
  ok(cfg.min === 4, 'MIN_POOL is 4 (got ' + cfg.min + ')');

  const pools = await p.evaluate(() => {
    ['r1','r2','r4','r5','r6','r7'].forEach((rid, k) => { S.s[rid] = P.map((_, pi) => 20 + k * 2 + pi); });
    return P.map((pl, pi) => { const st = standing(pi);
      return { name: pl.n, n: st.n, usedBackup: st.rs.some(r => r.backup) }; });
  });
  ok(pools.every(x => x.n >= 4), 'nobody falls below a pool of 4 (got ' + pools.map(x => x.n).join(',') + ')');
  ok(pools.filter(x => x.usedBackup).map(x => x.name).join() === 'Drew', 'on the full schedule only Drew needs the backup (got ' + pools.filter(x => x.usedBackup).map(x => x.name).join() + ')');
  ok(pools.filter(x => x.n === 5).map(x => x.name).join() === 'Matt' && pools.filter(x => x.n === 4).length === 8,
     'Matt on 5 rounds, everyone else on 4 (got ' + pools.map(x => x.n).join(',') + ')');

  // Drew has only 3 Sand Valley rounds (sits Tue PM and Wed AM) -> Lawsonia backfills.
  const short = await p.evaluate(() => {
    const st = standing(1);
    return { n: st.n, used: st.rs.some(r => r.backup), pool: st.rs.map(r => r.rid).join(' ') };
  });
  ok(short.n === 4 && short.used, 'a newly short player backfills from Lawsonia (pool ' + short.pool + ')');
  ok(/r1/.test(short.pool), 'the backfilled round is Lawsonia Links');

  // A full Sand Valley pool ignores Lawsonia even when Lawsonia was the best round.
  const full = await p.evaluate(() => { S.s.r1[0] = 60; const st = standing(0);
    return { used: st.rs.some(r => r.backup), n: st.n }; });
  ok(!full.used && full.n === 5, 'a full Sand Valley pool never pulls Lawsonia in');

  // Daniel has no Lawsonia round at all; he must still reach a full pool.
  const daniel = await p.evaluate(() => { const st = standing(8);
    return { n: st.n, used: st.rs.some(r => r.backup) }; });
  ok(daniel.n === 4 && !daniel.used, 'Daniel reaches a pool of 4 without any Lawsonia round');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 13b. The board must SHOW why a pool is what it is --------------------
  console.log('\n[13b] Standings expose backup and short pools');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  await p.evaluate(() => {
    ['r1','r2','r4','r5','r6','r7'].forEach((rid, k) => { S.s[rid] = P.map((_, pi) => 24 + k + pi); });
    S.o.r5 = [1, 4];         // Brook also skips Tue PM -> 3 Sand Valley rounds, Lawsonia backfills
    S.o.r6 = [1, 8];         // Drew as usual, plus Daniel -> 3 rounds and no Lawsonia for him
  });
  await p.click('nav button[data-v="stand"]'); await p.waitForTimeout(400);
  const marks = await p.evaluate(() => {
    const cell = name => { const tr = [...document.querySelectorAll('#v-stand tbody tr')]
      .find(t => new RegExp(name).test(t.textContent));
      return tr ? tr.querySelectorAll('td')[2].textContent.trim() : null; };
    const notes = [...document.querySelectorAll('#v-stand .note')].map(n => n.textContent);
    return { brook: cell('Brook'), daniel: cell('Daniel'), matt: cell('Matt'),
             starNote: notes.some(n => /Lawsonia round counts as one/.test(n)),
             bangNote: notes.some(n => /no Lawsonia round to fall back on/.test(n)) };
  });
  ok(marks.brook === '4*', 'a backfilled pool is marked with * (got ' + marks.brook + ')');
  ok(marks.daniel === '3!', 'a short pool with no backup is marked with ! (got ' + marks.daniel + ')');
  ok(marks.matt === '5', 'a full pool carries no marker (got ' + marks.matt + ')');
  ok(marks.starNote, 'the * footnote explains the Lawsonia backfill');
  ok(marks.bangNote, 'the ! footnote explains the thin pool');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 13c. A redundant sit-out override must not discard the baseline -------
  console.log('\n[13c] Baseline survives a no-op sit-out override');
  p = await newPage(browser);
  // Published board carries o.r4 = [Brook], which is exactly the default sit-out.
  await mockApi(p, { file: JSON.stringify({ v:1, s:{}, t:{}, p:{}, o:{ r4:[7] }, u:{}, i:{}, m: Date.now(), l:[] }),
                     sha:'s1', puts:[], commits:[] });
  await p.goto(URL); await settle(p);
  const noop = await p.evaluate(() => {
    const N = P.map(x => x.n);
    const base = BASE_GRID.r4.map(g => g.slice().sort((a,b)=>P[a].idx-P[b].idx).map(i=>N[i]).join('/'));
    const live = S.p.r4.map(g => g.map(i=>N[i]).join('/'));
    return { base, live, sit: sitOuts(R.find(r=>r.id==='r4')).map(i=>N[i]).join(',') };
  });
  ok(JSON.stringify(noop.live) === JSON.stringify(noop.base),
     'r4 still uses BASE_GRID despite a no-op sit-out override (got ' + noop.live.join(' | ') + ')');
  ok(noop.sit === 'Paul', 'sit-out unchanged (got ' + noop.sit + ')');

  // A REAL sit-out change must still fall through to generate().
  const real = await p.evaluate(() => {
    const N = P.map(x => x.n);
    S.p = {}; S.o.r4 = [7, 6];              // Paul AND Ryan now sit
    defaultPairings();
    return { n: S.p.r4.reduce((a,g)=>a+g.length,0), has: S.p.r4.flat().includes(6) };
  });
  ok(real.n === 7 && !real.has, 'a genuine sit-out change regenerates the round (7 playing, Ryan out)');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 14. Monday is a split round: two groups, two courses -----------------
  console.log('\n[14] Monday Sand Valley / Mammoth split');
  p = await newPage(browser);
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);

  const split = await p.evaluate(() => {
    const rd = R.find(x => x.id === 'r2'), N = P.map(x => x.n);
    return {
      course: rd.course, tees: rd.tees, counts: rd.counts,
      sit: sitOuts(rd).map(i => N[i]).join(','),
      groups: S.p.r2.map(grp => grp.map(pi => ({
        name: N[pi], course: courseOf(rd, pi), slope: teeFor(rd, pi)[2],
        quota: quotaFor(P[pi].idx, teeFor(rd, pi))
      })))
    };
  });
  ok(split.counts === true, 'Monday counts toward La Copa');
  ok(split.sit === 'Daniel', 'Daniel sits Monday morning (got ' + split.sit + ')');
  ok(split.groups[0].every(x => x.course === 'Sand Valley'), 'group 1 plays Sand Valley');
  ok(split.groups[1].every(x => x.course === 'The Lido'), 'group 2 plays the Lido');
  ok(split.groups[2].every(x => x.course === 'Mammoth Dunes'), 'group 3 plays Mammoth Dunes');
  ok(split.groups[1].map(x => x.name).sort().join(',') === 'Drew,Matt', 'Drew and Matt are the Lido twosome');
  ok(split.groups[0][0].slope === 138 && split.groups[1][0].slope === 144 && split.groups[2][0].slope === 136,
     'each group gets its own slope (SV 138 / Lido 144 / Mammoth 136)');
  ok(split.groups.every(g => g.every(x => x.quota > 0 && Number.isInteger(x.quota))),
     'quotas resolve on both legs');

  await p.click('nav button[data-v="today"]'); await p.waitForTimeout(200);
  await p.selectOption('#roundSel', '1'); await p.waitForTimeout(300);
  const todayTxt = await p.evaluate(() => document.querySelector('#v-today').innerText);
  ok(/Group 1\s*10:10\s*Sand Valley . Orange tees/.test(todayTxt) && /Group 2\s*10:30\s*The Lido . White tees/.test(todayTxt)
     && /Group 3\s*10:30\s*Mammoth Dunes . Orange tees/.test(todayTxt),
     'Today labels each group with its own course, tees and tee time');
  ok(!/Woodlands/i.test(todayTxt), 'no Woodlands on Today');

  // Enter tab must offer each player the presets for the course they played.
  await p.click('nav button[data-v="enter"]').catch(() => {});
  await p.waitForTimeout(250);
  const enterTxt = await p.evaluate(() => {
    const el = document.querySelector('#v-enter'); return el ? el.innerText : '';
  });
  ok(!/Woodlands/i.test(enterTxt), 'no Woodlands on Enter');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // every tab renders for the editor
  p = await newPage(browser, 'github_pat_TEST');
  await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  for (const t of ['info', 'today', 'enter', 'stand', 'pair']) {
    await p.click(`nav button[data-v="${t}"]`, { timeout: 4000 }).catch(e => p.errs.push('click ' + t));
    await p.waitForTimeout(180);
  }
  ok(p.errs.length === 0, 'all five tabs render clean' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 15. Picking up code updates (Safari / Pages cache) -----------------
  // Served over a local HTTP server: the update check only runs on http(s).
  console.log('\n[15] Code updates reach an open tab; stale hashes do not freeze the grid');
  {
    const http = require('http'), fs = require('fs');
    const NEW = fs.readFileSync(URL.replace('file://', ''), 'utf8');
    const m7 = NEW.match(/"r4":(\[\[[\d,]+\],\[[\d,]+\]\])/);
    // An "old build": same page with two players swapped between the r4 groups.
    const cur7 = JSON.parse(m7[1]), old7 = cur7.map(g => g.slice());
    [old7[0][0], old7[1][0]] = [cur7[1][0], cur7[0][0]];
    const OLD = NEW.replace(m7[0], '"r4":' + JSON.stringify(old7));
    let serve = OLD, staleV = false, hits = [];
    const srv = http.createServer((q, r) => {
      hits.push(q.url);
      r.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'max-age=600' });
      r.end(q.url.includes('?v=') && staleV ? OLD : serve);
    });
    await new Promise(res => srv.listen(0, res));
    const HURL = `http://localhost:${srv.address().port}/sandvalleyvatoz/`;
    const grid = pg => pg.evaluate(() => JSON.stringify(S.p.r4.map(g => g.slice().sort()).sort()));
    const want = await (async () => { const q = await newPage(browser); await q.goto(URL); await settle(q);
      const g = await grid(q); await q.context().close(); return g; })();

    p = await newPage(browser); await mockApi(p, makeRepo());
    await p.goto(HURL); await settle(p);
    ok(!p.url().includes('?v='), 'no reload when the running code is current');
    ok(await grid(p) !== want, 'old build shows the old grid (test setup)');
    const st = await p.evaluate(() => JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1))))));
    ok(Object.keys(st.p).length === 0 && !!st.g, 'baseline rounds stay out of the hash; grid stamp is in');

    serve = NEW;
    await p.evaluate(() => { lastUpdCheck = 0; checkForUpdate(); });
    await p.waitForURL(/\?v=/, { timeout: 5000 }).catch(() => {}); await settle(p);
    ok(p.url().includes('?v='), 'a code update reloads the tab onto ?v=<build>');
    ok(await grid(p) === want, 'and the new grid shows');

    staleV = true; hits = [];
    const p2 = await p.context().newPage();
    await p2.goto(HURL + '?v=zzz'); await p2.waitForTimeout(2000);
    const loads = hits.filter(h => !h.includes('cb=')).length;
    ok(loads <= 2, `no redirect loop when the CDN is stale (${loads} loads)`);
    await p.context().close();

    staleV = false;
    const staleHash = Buffer.from(JSON.stringify({ v: 1, s: {}, t: {}, p: { r4: old7 }, o: {}, u: {}, i: {}, m: 0, l: [] })).toString('base64');
    p = await newPage(browser); await mockApi(p, makeRepo());
    await p.goto(HURL + '#' + staleHash); await settle(p);
    ok(await grid(p) === want, 'an old link carrying a previous grid shows the current one');
    await p.evaluate(() => { S.p.r4 = [[1, 4, 2, 6], [8, 0, 5, 3]]; edit(); });
    await p.reload(); await settle(p);
    ok(await p.evaluate(() => S.p.r4.map(g => g.slice().sort().join(',')).join('|')) === '1,2,4,6|0,3,5,8',
       'an unpublished hand edit survives a reload');
    ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
    await p.context().close();
    srv.close();
  }

  // ---- 16. Header "last updated" covers code changes, not just publishes -----
  console.log('\n[16] Header reflects the newer of the last publish and the last site update');
  p = await newPage(browser); await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  const hdr = await p.evaluate(() => {
    const out = {};
    syncBusy = false; lastSyncErr = ''; dirty = false;   // isolate from the boot pull
    S.m = SITE_UPDATED - 86400000; renderSync();          // board published a day before the site changed
    out.older = document.querySelector('#syncTxt').title === new Date(SITE_UPDATED).toLocaleString();
    S.m = SITE_UPDATED + 3600000; renderSync();           // publish after the site change
    out.newer = document.querySelector('#syncTxt').title === new Date(S.m).toLocaleString();
    return out;
  });
  ok(hdr.older, 'a site update newer than the last publish shows as the update time');
  ok(hdr.newer, 'a publish newer than the site update shows as the update time');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  // ---- 17. Courses by player on the Pairings tab -----------------------------
  console.log('\n[17] Courses-by-player table');
  p = await newPage(browser); await mockApi(p, makeRepo());
  await p.goto(URL); await settle(p);
  await p.click('nav button[data-v="pair"]'); await p.waitForTimeout(300);
  const cc = await p.evaluate(() => {
    const card = [...document.querySelectorAll('#v-pair .card')].find(c => /Courses by player/.test(c.textContent));
    if (!card) return null;
    const row = n => [...card.querySelectorAll('tbody tr')].find(t => t.cells[0].textContent === n);
    const cells = n => [...row(n).cells].slice(1).map(c => c.textContent.trim()).join(',');
    return { last: card === [...document.querySelectorAll('#v-pair .card')].pop(), tony: cells('Tony'), mike: cells('Mike'), matt: cells('Matt') };
  });
  ok(cc && cc.last, 'viewers see the courses table at the bottom of Pairings');
  ok(cc && cc.tony === '1,1,1,1,4', 'Tony plays all four courses (got ' + (cc && cc.tony) + ')');
  ok(cc && cc.mike === '1,\u2013,2,1,4', 'Mike has no Lido, shown as a dash (got ' + (cc && cc.mike) + ')');
  ok(cc && cc.matt === '1,1,2,1,5', 'Matt plays five counting rounds (got ' + (cc && cc.matt) + ')');
  ok(p.errs.length === 0, 'no page errors' + (p.errs.length ? ': ' + p.errs[0] : ''));
  await p.context().close();

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
