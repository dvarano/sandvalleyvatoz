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

  // every tab renders for the editor
  await p.context().close();
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
