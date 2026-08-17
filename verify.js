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
  ok(JSON.stringify(await tabs(p)) === '["info","today","stand"]', 'Enter and Pairings hidden for viewer');
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
  ok(JSON.stringify(await tabs(p)) === '["info","today","stand"]', 'still read-only');
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
    return { met: Object.keys(h).length, max: Math.max(...Object.values(h)), zero: z.length,
      md: h[k(N.indexOf('Matt'), N.indexOf('Daniel'))] || 0, dp: h[k(N.indexOf('Drew'), N.indexOf('Paul'))] || 0,
      r5: sitOuts(R.find(r => r.id === 'r5')).map(i => N[i]).join(), r7: sitOuts(R.find(r => r.id === 'r7')).map(i => N[i]).join() };
  });
  ok(inv.met === 36 && inv.zero === 0, '36/36 pairs, none at zero');
  ok(inv.max <= 3, 'max repeat ' + inv.max + ' <= 3');
  ok(inv.md >= 2, 'Matt+Daniel ' + inv.md + ' >= 2');
  ok(inv.dp >= 2, 'Drew+Paul ' + inv.dp + ' >= 2');
  ok(inv.r5 === 'Drew' && inv.r7 === 'Paul', 'sit-outs intact (r5 ' + inv.r5 + ', r7 ' + inv.r7 + ')');

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
  ok(g11.sit === 'Paul', 'r7 sit-out comes from code, not the published file (got ' + g11.sit + ')');
  ok(/Brook\/Drew\/Eric\/Matt/.test(g11.r7), 'r7 groups are the current code grid (got ' + g11.r7 + ')');
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

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
