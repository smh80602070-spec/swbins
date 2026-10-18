// 플레이 QC(W-0270) — 다섯 판을 사람처럼 조작해 본다: PC(1280×720 키·마우스)·폰(390×844 터치) 두 기기.
//   node pw-play.mjs [판…] [--pc|--phone] [--base http://127.0.0.1:8871/]   (서버는 돌리는 쪽이 띄운다 — qc.mjs 가 그렇게 한다)
// 판×기기마다 새 컨텍스트: 가입 → 판별 첫 관문 → 장면 걷기 → 들어감 → 측정:
//   부팅 ms · 예외 0 · FPS(1초 rAF; 0 이면 FAIL) · 키 4방향(각 KEY_MS, 판 API 위치가 minMove 넘게 움직이면 ○; 3/4 이상 PASS)
//   · PC 마우스 끌기 / 폰 터치(ADAPT.touch: joy:#id 손잡이 밀기 · pad:#id 오른쪽 단추 · canvas 화면 오른쪽 누르기)
//   · ☰ 메뉴 → 첫 칸 창 → 닫기 → 다시 키 이동(창 닫은 뒤 입력이 죽는 회귀) · HUD 겹침(WARN) · 새로 고침 → 이어하기 → 들어감 · 판별 덤(ADAPT.extra)
// 결과: 콘솔 + results/pw-play.json · 사진 shots/play/<판>-<기기>-<n>.png(커밋 안 함). 종료 코드 = FAIL 수.
// Opus 가 항목을 더할 때: ADAPT[판].extra 에 { name, run(ctx) → { ok, detail } } 하나. 공통 측정은 measure() 한 곳. 임계는 ADAPT[판].minMove.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs, gpuInfo, isSoftware } from './cdp.mjs';
let GPU_NAME = null;   // W-0314 이 실행이 실제로 그린 렌더러

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : (process.env.PW_BASE || 'http://127.0.0.1:8871/')).replace(/\/?$/, '/');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const DEVICES = argv.includes('--pc') ? ['pc'] : argv.includes('--phone') ? ['phone'] : ['pc', 'phone'];
const KEY_MS = 1200;
const SHOTS = path.join(HERE, 'shots', 'play');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* ── 판별 손잡이 ── */
const ADAPT = {
  'saga-go': {
    pos: () => { const p = DG.core.save.player.pos; return p ? { x: p.x, y: p.y } : null; },
    minMove: 0.5, touch: 'joy:#gjoy', drag: 'none',   // 1만리는 끌기가 걷기가 아니다(클릭 이동·조이스틱)
    extra: [{ name: '클릭 이동(빈 땅 → 걷기 · 짐승 → 만남)', run: async (c) => {
      /* W-0273 — 누른 자리에 짐승이 있으면 가까울 땐 만남(전투), 멀면 그쪽으로 걷는다(world.js onClick). 둘 다 정상 반응.
         빈 땅을 먼저 찾아 누르고(여러 자리), 끝내 짐승만 걸리면 만남도 ○ 로 친다 */
      await c.clearIntro();
      await c.ev(() => { window.__pwEv = []; if (!window.__pwEvOn) { window.__pwEvOn = 1; DG.core.on('encounter:request', () => window.__pwEv.push('만남')); } });
      const W = c.phone ? 390 : 1280, H = c.phone ? 844 : 720;
      const pts = [[0.5, 0.42], [0.3, 0.5], [0.7, 0.5], [0.5, 0.6], [0.25, 0.35], [0.75, 0.35]];
      const tried = [];
      for (const [fx, fy] of pts) {
        const x = Math.round(W * fx), y = Math.round(H * fy);
        const top = await c.topAt(x, y);
        if (!/^(#map|canvas)/.test(top)) { tried.push(top); continue; }
        await c.ev(() => { window.__pwEv = []; const e = document.querySelector('#encounter.show'); if (e) { e.classList.remove('show'); } });
        const a = await c.pos();
        await c.page.mouse.move(x, y); await sleep(150); await c.page.mouse.click(x, y); await sleep(400);
        const r = await c.ev(() => ({ w: !!(DG.world.walkingTo && DG.world.walkingTo()), ev: window.__pwEv.slice().concat(document.querySelector('#encounter.show, #rogue-hud.show, #duel.show') ? ['만남 화면'] : []) }));
        if (r.w) { await sleep(2000); const d = c.dist(a, await c.pos()); if (d > 0.5) { return { ok: true, detail: `걷기 ${d.toFixed(1)} @${x},${y}` + (tried.length ? ' · ' + tried.join(' ') : '') }; } tried.push('막힘@' + x + ',' + y); continue; }   // W-0277 — 누른 자리가 집 벽이면 걷기가 시작돼도 제자리(10-17 시작 자리 앞 집) → 다음 빈 땅으로
        if (r.ev.length) { tried.push('만남@' + x + ',' + y); return { ok: true, detail: '짐승을 눌러 만남(정상 반응) · ' + tried.join(' ') }; }
        tried.push('무반응@' + x + ',' + y);
      }
      const met = tried.some((t) => t.startsWith('만남'));
      return { ok: met, detail: (met ? '빈 땅 못 찾음 — 짐승 눌러 만남(정상) · ' : '반응 없음 · ') + tried.join(' ') };
    } }]
  },
  'saga-dungeon': {
    /* W-0314 — 던전이 열려 있으면 던전 좌표 먼저(실제 GPU 속도에선 키 이동이 굴혈 입구까지 걸어 들어가 던전이 열리는데, 마을 좌표를 읽어 이동 0 으로 셌다) */
    pos: () => { const D = DG.dungeon, r = D && D.active && D.active() && D.raw ? D.raw() : null; if (r && r.player) { return { x: r.player.x, y: r.player.y }; } const T = DG.town; if (T && T.active() && T.me) { return T.me(); } const r2 = D.raw(); return r2 && r2.player ? { x: r2.player.x, y: r2.player.y } : null; },
    minMove: 8, touch: 'canvas',
    gate: async (c) => { await c.ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((x) => x.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); },
    extra: [{ name: '던전 입장 뒤 키 이동', run: async (c) => {
      await c.ev(() => { if (DG.town.active()) { DG.town.leave(); } DG.dungeon.enter({ floor: 1 }); }); await sleep(3500); await c.clearIntro();
      const on = await c.ev(() => !!DG.dungeon.active()); if (!on) { return { ok: false, detail: '던전이 안 켜짐' }; }
      const r = await c.keys(['KeyD', 'KeyS']); await c.shot('dungeon'); return { ok: r.okN >= 1, detail: r.detail };
    } }]
  },
  'saga-forest': {
    pos: () => { const p = DG.village.raw().player; return p ? { x: p.x, y: p.y } : null; },
    minMove: 5, touch: 'joy:#vjoy',
    extra: [{ name: '클릭 이동(moveTarget)', run: async (c) => { const a = await c.pos(); const [x, y] = c.center(0.35); const top = await c.topAt(x, y); await c.page.mouse.move(x, y); await sleep(200); await c.page.mouse.click(x, y); await sleep(400); const t = await c.ev(() => !!DG.village.moveTarget()); await sleep(2500); const d = c.dist(a, await c.pos()); return { ok: d > 5 || t, detail: `이동 ${d.toFixed(1)} 목표 ${t} @${top}` }; } }]
  },
  'saga-story': {
    pos: () => { const r = DG.side.raw(); return r && r.player ? { x: r.player.x, y: r.player.y } : null; },
    minMove: 5, touch: 'pad:#touchpad', dragX: 0.8, dragY: 0.75, keys: ['KeyD', 'KeyA', 'ArrowLeft', 'ArrowRight'],   // 옆보기라 가로만   // 4종횡은 화면 아래쪽 절반을 누르면 그쪽으로 달린다
    prep: async (c) => { const s = await c.ev(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; return st ? { key: st.key, ok: S.enter(st.key) } : null; }); await sleep(3000); await c.clearIntro(); return s ? `사냥터 ${s.key}` : '사냥터 없음'; },
    extra: [{ name: '자동 사냥으로 적을 때림(30초)', run: async (c) => {
      /* W-0272 — 4종횡엔 side:hit 이벤트가 없다(side:kill 만). 살아 있는 적 체력 합이 줄거나 처치 수가 오르면 때린 것 */
      const snap = () => c.ev(() => { const r = DG.side.raw(); if (!r) { return null; } return { hp: Math.round(r.enemies.filter((e) => e.hp > 0).reduce((a, e) => a + e.hp, 0)), n: r.enemies.filter((e) => e.hp > 0).length, kills: r.kills || 0, x: Math.round(r.player.x), doing: DG.auto.status ? DG.auto.status().doing : '' }; });
      const a = await snap(); if (!a) { return { ok: false, detail: '사냥터 아님' }; }
      await c.ev(() => DG.auto.setOn(true));
      let b = a;
      for (let k = 0; k < 60; k++) { await sleep(500); await c.clearIntro(); b = await snap(); if (b && (b.kills > a.kills || b.hp < a.hp - 1)) { break; } }
      await c.ev(() => DG.auto.setOn(false));
      const ok = !!b && (b.kills > a.kills || b.hp < a.hp - 1);
      return { ok, detail: `적 체력 ${a.hp}→${b && b.hp} · 처치 ${a.kills}→${b && b.kills} · x ${a.x}→${b && b.x} · ${b && b.doing}` };
    } }]
  },
  'saga-realm': {
    pos: () => { const R3 = DG.realm3d; if (R3 && R3.active && R3.active() && R3.focusMap) { const f = R3.focusMap(); return { x: f.x, y: f.y }; } return null; },
    minMove: 0.5, touch: 'joy:#rjoy', moveKeys: 'optional', posOptional: true,   // 턴제 — 3D 지도가 켜졌을 때만 초점이 움직인다
    gate: async (c) => { await c.page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await c.page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); },
    extra: [{ name: '3D 지도 끌기(panBy)', run: async (c) => { const a = await c.pos(); if (!a) { return { ok: true, skip: true, detail: '3D 지도 꺼짐' }; } await c.ev(() => { for (let i = 0; i < 20; i++) { DG.realm3d.panBy(1, 0); } }); await sleep(500); const d = c.dist(a, await c.pos()); return { ok: d > 0.5, detail: `이동 ${d.toFixed(2)}` }; } },
      { name: '다음 달(next-month) 예외 없음', run: async (c) => { const t0 = await c.ev(() => DG.rtk.state().turn); const had = await c.ev(() => { const b = document.querySelector('[data-act="next-month"]'); if (b) { b.click(); return true; } return false; }); if (!had) { return { ok: true, skip: true, detail: '단추 없음' }; } await sleep(2500); await c.clearIntro(); const t1 = await c.ev(() => DG.rtk.state().turn); return { ok: t1 > t0, detail: `turn ${t0}→${t1}` }; } }]
  }
};

/* ── 공통 ── */
async function openCtx(browser, device) {
  const phone = device === 'phone';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, serviceWorkers: 'block', ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(SEED);
  const cdp = await ctx.newCDPSession(page);
  try { await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없어도 된다 */ }
  return { ctx, page, cdp, phone };
}
const realErrors = (errs) => errs.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_|swiftshader/i.test(e) && !/tile\.openstreetmap|overpass|ERR_INTERNET|ERR_NAME|favicon|license\.json|navigator\.vibrate/i.test(e));

async function one(browser, g, device) {
  const A = ADAPT[g];
  const { ctx, page, cdp, phone } = await openCtx(browser, device);
  const errors = [], checks = [], shots = [];
  page.on('pageerror', (e) => errors.push('EXC ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') { errors.push('console ' + m.text().slice(0, 200)); } });
  const url = BASE + g + '/';
  const c = {
    page, phone,
    ev: (fn, arg) => page.evaluate(fn, arg),
    pos: () => page.evaluate(A.pos),
    dist: (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y) : -1,
    /** 화면 가운데 x · 세로 비율 y(폰 390 너비에서도 화면 안) */
    center: (fy) => [Math.round((phone ? 390 : 1280) / 2), Math.round((phone ? 844 : 720) * fy)],
    topAt: (x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/s+/)[0] : '')) : 'none'; }, [x, y]),
    shot: async (k) => { const f = path.join(SHOTS, `${g}-${device}-${k}.png`); await page.screenshot({ path: f }); shots.push(f); return f; },
    clearIntro: async () => {
      for (let i = 0; i < 14; i++) {
        const open = await page.evaluate(() => !!((window.DG && DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (window.DG && DG.story && DG.story.isOpen && DG.story.isOpen())));
        if (!open) { break; }
        await page.evaluate(() => { if (DG.scenario && DG.scenario.skip) { DG.scenario.skip(); } else if (DG.story && DG.story.skip) { DG.story.skip(); } }); await sleep(250);
      }
      await page.evaluate(() => {
        document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } });
        const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); }
        const mg = document.getElementById('menu-grid'); if (mg) { mg.classList.remove('show'); }
        /* 1만리만 — 5천하는 같은 #encounter 에 시나리오·세력 고르기를 띄운다(닫으면 빈 화면). 1만리 만남 카드(#encounter) 가 화면 가운데를 덮으면 클릭 이동이 카드를 누른다 — 닫기 단추, 없으면 show 를 뗀다 */
        const enc = document.querySelector('#encounter.show'); if (enc && !enc.querySelector('[data-act^="pick-"]') && location.pathname.indexOf('/saga-go/') >= 0) { const bt = [...enc.querySelectorAll('button')].find((x) => /닫기|물러난다|나중에|✕/.test(x.textContent)); if (bt) { bt.click(); } else { enc.classList.remove('show'); } }
      });
    },
    /** 키 몇 개를 차례로 눌러 위치 변화를 센다 */
    keys: async (codes) => {
      const parts = []; let okN = 0;
      for (const code of codes) {
        const a = await c.pos();
        await page.keyboard.down(code); await sleep(KEY_MS); await page.keyboard.up(code); await sleep(250);
        const d = c.dist(a, await c.pos());
        const ok = d > A.minMove; if (ok) { okN++; }
        parts.push(`${code.replace(/^Key|^Arrow/, '')}${ok ? '○' : '×'}${d >= 0 ? d.toFixed(1) : '?'}`);
      }
      return { okN, n: codes.length, detail: parts.join(' ') };
    }
  };
  const check = (name, ok, detail, opt) => { checks.push({ name, ok: !!ok, detail: String(detail || '').slice(0, 240), ...(opt || {}) }); };
  const step = async (name, fn) => { const t = Date.now(); try { const r = await fn(); if (r && typeof r === 'object' && 'ok' in r) { check(name, r.ok, r.detail, { ms: Date.now() - t, skip: !!r.skip, warn: !!r.warn }); return r.ok; } check(name, r !== false, typeof r === 'string' ? r : '', { ms: Date.now() - t }); return r !== false; } catch (e) { check(name, false, 'ERR ' + e.message.slice(0, 160), { ms: Date.now() - t }); return false; } };
  const inGame = () => page.evaluate(() => { const gd = document.getElementById('boot-guard'), d = document.getElementById('dock'); const shown = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); return !document.querySelector('#acc-host.show') && !shown(gd) && shown(d); });
  const posOK = async () => { const p = await c.pos(); return p && isFinite(p.x) && isFinite(p.y); };

  try {
    /* 부팅 */
    const tBoot = Date.now();
    await step('부팅(가입→첫 관문→들어감)', async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('플레이'); });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
      await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
      await c.clearIntro();
      if (A.gate) { await A.gate(c); }
      await c.clearIntro(); await sleep(1500);
      const prep = A.prep ? await A.prep(c) : '';
      await c.clearIntro();
      return { ok: await inGame(), detail: `${Date.now() - tBoot}ms ${prep}` };
    });
    await c.shot('0');
    await step('위치를 읽을 수 있다', async () => { const ok = await posOK(); return { ok: ok || !!A.posOptional, skip: !ok && !!A.posOptional, detail: JSON.stringify(await c.pos()) }; });
    /* W-0314 — 0.5초 쉬고 2초 rAF. 실제 GPU 일 때만 판정(PC ≥30 PASS · 20~30 WARN · <20 FAIL), 폰 흉내·소프트웨어는 숫자만(0 이면 FAIL) */
    await step('FPS', async () => { const n = await c.ev(() => new Promise((r) => { setTimeout(() => { let k = 0; const t0 = performance.now(); (function f() { k++; const t = performance.now() - t0; if (t < 2000) { requestAnimationFrame(f); } else { r(Math.round(k / (t / 1000))); } })(); }, 500); }));
      const soft = isSoftware(GPU_NAME), judge = !soft && device === 'pc';
      return { ok: n > 0 && (!judge || n >= 20), warn: judge ? n < 30 : n < 8, detail: `${n} fps` + (soft ? '(소프트웨어 — 상대값)' : judge ? '(GPU · PC 30 이상 PASS)' : '(GPU · 폰 흉내 — 숫자만)') }; });
    /* 이동 — 키 */
    const kr = await c.keys(A.keys || ['KeyD', 'KeyS', 'ArrowLeft', 'ArrowUp']);
    check('키 4방향 이동(3/4 이상)', A.moveKeys === 'optional' ? true : kr.okN >= 3, kr.detail, { skip: A.moveKeys === 'optional' && kr.okN < 3 });
    /* W-0314 — 실제 GPU 속도에선 키 이동이 길어 표식(2나락 난입·결사비)을 밟아 확인 창이 뜬다 → 다음 단계(끌기·메뉴)를 막지 않게 그 창을 닫는다(Esc 가 아니라 창의 닫기 단추 — 4종횡은 Esc 가 메뉴) */
    const encShut = await c.ev(() => { const b = document.querySelector('#encounter.show [data-act="enc-close"]'); if (b) { b.click(); return true; } return false; }); if (encShut) { await sleep(300); }
    /* 같은 까닭으로 가게·NPC 표식이 연 옆 시트(body.sheet-open)가 남아 터치를 먹는다 — 사람처럼 Esc 로 닫는다(4종횡은 Esc 가 메뉴라 뺌) */
    for (let i = 0; i < 3 && g !== 'saga-story'; i++) { const open = await c.ev(() => !!(document.querySelector('#sheet.show, #encounter.show') || document.body.classList.contains('sheet-open'))); if (!open) { break; } await page.keyboard.press('Escape'); await sleep(300); }
    /* 이동 — 마우스 끌기 / 터치 */
    if (!phone) {
      await step('마우스 끌기 이동', async () => { if (A.drag === 'none') { return { ok: true, skip: true, detail: '이 판은 끌기가 걷기가 아님' }; } const a = await c.pos(); const [cx0, my] = c.center(A.dragY || 0.5); const mx = A.dragX ? Math.round((c.phone ? 390 : 1280) * A.dragX) : cx0; await page.mouse.move(mx, my); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(mx + i * 12, my + i * 6); await sleep(40); } await sleep(1500); await page.mouse.up(); await sleep(250); const d = c.dist(a, await c.pos()); return { ok: A.moveKeys === 'optional' ? true : d > A.minMove, detail: `이동 ${d.toFixed(1)}` }; });
    } else {
      await step('터치 이동(' + A.touch + ')', async () => {
        const a = await c.pos();
        const [kind, sel] = A.touch.split(':');
        let x, y, dx = 50, dy = -20;
        if (kind === 'joy') { const r = await c.ev((s) => { const e = document.querySelector(s); if (!e) { return null; } const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; }, sel); if (!r) { return { ok: false, detail: sel + ' 없음' }; } x = r.x; y = r.y; dx = r.w * 0.4; dy = -r.w * 0.15; }
        else if (kind === 'pad') { const r = await c.ev((s) => { const p = document.querySelector(s); if (!p) { return null; } const pref = p.querySelector('[data-dir="right"]'); const bs = (pref ? [pref] : [...p.querySelectorAll('button, [data-dir], .pad-btn')]).map((b) => b.getBoundingClientRect()).filter((b) => b.width > 10); if (!bs.length) { const b = p.getBoundingClientRect(); return { x: b.right - 30, y: b.top + b.height / 2 }; } const r = bs.sort((a, b) => b.left - a.left)[0]; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); if (!r) { return { ok: false, detail: sel + ' 없음' }; } x = r.x; y = r.y; dx = 0; dy = 0; }
        else { x = 330; y = 420; dx = 0; dy = 0; }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        for (let i = 1; i <= 8 && (dx || dy); i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8, id: 1 }] }); await sleep(30); }
        await sleep(2000);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(250);
        const d = c.dist(a, await c.pos());
        return { ok: A.moveKeys === 'optional' ? true : d > A.minMove, detail: `이동 ${d.toFixed(1)} @${Math.round(x)},${Math.round(y)}` };
      });
    }
    /* ☰ 메뉴 → 창 → 닫기 → 다시 이동 */
    await step('☰ 메뉴 → 첫 칸 창 → 닫기 → 키 이동', async () => {
      const opened = await c.ev(() => { const b = document.getElementById('btn-menu'); if (b) { b.click(); } return !!document.querySelector('#menu-grid.show'); });
      if (!opened) { return { ok: false, detail: '☰ 메뉴 안 열림' }; }
      await c.ev(() => { const x = document.querySelector('#menu-grid .mg-cell'); if (x) { x.click(); } }); await sleep(1200);
      const win = await c.ev(() => !!(document.querySelector('#sheet.show, #encounter.show, #detail.show, #overworld-map.show') || (DG.passiveWebUI && DG.passiveWebUI.isOpen && DG.passiveWebUI.isOpen()) || (DG.minimap && DG.minimap.isBig && DG.minimap.isBig())));
      await c.shot('menu');
      for (let i = 0; i < 4; i++) { const anyOpen = await c.ev(() => !!(document.querySelector('#menu-grid.show, #sheet.show, #encounter.show, #detail.show, #overworld-map.show') || (DG.passiveWebUI && DG.passiveWebUI.isOpen && DG.passiveWebUI.isOpen()) || (DG.minimap && DG.minimap.isBig && DG.minimap.isBig()))); if (!anyOpen) { break; } await page.keyboard.press('Escape'); await sleep(200); await c.ev(() => { document.querySelectorAll('button').forEach((b) => { if (b.offsetParent && /^(닫기|✕|×)$/.test(b.textContent.trim())) { b.click(); } }); }); }
      await c.ev(() => { const mg = document.getElementById('menu-grid'); if (mg) { mg.classList.remove('show'); } });
      await sleep(300);
      const still = await c.ev(() => !!(document.querySelector('#menu-grid.show, #sheet.show, #encounter.show, #detail.show, #overworld-map.show') || (DG.passiveWebUI && DG.passiveWebUI.isOpen && DG.passiveWebUI.isOpen())));
      let r = await c.keys(['KeyD']);
      for (const k2 of ['KeyA', 'KeyS', 'KeyW']) { if (r.okN === 1) { break; } const r2 = await c.keys([k2]); r = { okN: r2.okN, detail: r.detail + ' ' + r2.detail }; }   // W-0277 — 입력이 살았는지만 본다: D 쪽이 벽(10-17 1만리 시작 자리 앞 집)이면 다른 쪽으로
      return { ok: win && !still && (A.moveKeys === 'optional' || r.okN === 1), detail: `창 ${win ? '열림' : '안 열림'} · 닫힘 ${!still} · ${r.detail}` };
    });
    /* HUD 겹침 */
    await step('HUD 겹침(보이는 고정 요소 쌍)', async () => {
      const pairs = await c.ev(() => {
        const W = innerWidth, H = innerHeight;
        const els = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') { return false; } if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || cs.pointerEvents === 'none') { return false; } const r = e.getBoundingClientRect(); return r.width >= 40 && r.height >= 40 && r.bottom > 0 && r.right > 0 && r.left < W && r.top < H && (r.width * r.height) < W * H * 0.5; });
        const name = (e) => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        const out = [];
        for (let i = 0; i < els.length; i++) { for (let j = i + 1; j < els.length; j++) {
          const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) { continue; }
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w <= 0 || h <= 0) { continue; }
          const small = Math.min(ra.width * ra.height, rb.width * rb.height);
          if (w * h / small >= 0.5) { out.push(name(a) + ' ↔ ' + name(b)); }
        } }
        return out.slice(0, 6);
      });
      return { ok: true, warn: pairs.length > 0, detail: pairs.length ? pairs.join(' · ') : '없음' };
    });
    /* 판별 덤 */
    for (const ex of (A.extra || [])) { await step(ex.name, () => ex.run(c)); }
    /* 새로 고침 → 이어하기 */
    await step('새로 고침 → 이어하기 → 들어감', async () => {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
      await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
      await c.clearIntro(); await sleep(800);
      return { ok: await inGame(), detail: JSON.stringify(await c.pos()) };
    });
    await c.shot('1');
  } catch (e) { check('예외로 중단', false, e.message.slice(0, 200)); }
  const real = realErrors(errors);
  check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 3).join(' | '));
  await ctx.close();
  const fails = checks.filter((x) => !x.ok && !x.skip), warns = checks.filter((x) => x.ok && x.warn);
  return { game: g, device, ok: fails.length === 0, checks, fails: fails.map((x) => x.name), warns: warns.map((x) => x.name), shots };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs() });
{ const p0 = await browser.newPage(); GPU_NAME = await gpuInfo(p0); await p0.close(); console.log('GPU ' + GPU_NAME + (isSoftware(GPU_NAME) ? ' — 소프트웨어, FPS 는 상대값' : '')); }
const out = [];
try {
  for (const g of (games.length ? games : ALL)) {
    for (const d of DEVICES) {
      const r = await one(browser, g, d);
      out.push(r);
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${g} ${d} · ` + r.checks.map((x) => (x.skip ? '–' : x.ok ? (x.warn ? '△' : '○') : '×') + x.name + (x.ok && !x.warn ? '' : ' [' + x.detail.slice(0, 120) + ']')).join(' · '));
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(HERE, 'results', 'pw-play.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), gpu: GPU_NAME, runs: out }, null, 1));
const nf = out.filter((r) => !r.ok).length;
console.log(`PW-PLAY ${nf ? 'FAIL ' + nf : 'OK'} / ${out.length}`);
process.exit(nf ? 1 : 0);
