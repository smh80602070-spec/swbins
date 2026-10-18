// 그래픽 기준선 점검(W-0291) — 다섯 판 3D 를 실제로 띄워 기준선(shared/gfx-baseline.json)의 기능이 켜졌는지 잰다.
//   node pw-gfx.mjs [판…] [--base http://127.0.0.1:8871/]   (서버는 돌리는 쪽이 띄운다 — qc.mjs 가 그렇게 한다)
// 재는 법: three 의 WebGLRenderer.prototype.render 를 가로채 1.5초 동안 그려진 장면·렌더러를 모은다(판마다 창구가 달라도 같은 방법).
//   toon    = MeshToonMaterial 이거나 userData.toon / onBeforeCompile 붙은 재질이 있는가
//   tonemap = renderer.toneMapping !== 0          post = DG.post3d.available() && stats().drawn>0 또는 렌더 대상(target)이 있는 그리기
//   ssao    = DG.ssao3d.available() && stats() 가 그린 흔적   shadow = renderer.shadowMap.enabled && castShadow 메시 ≥ 3
//   sun     = DirectionalLight ≥ 1                   sky = scene.background 가 텍스처이거나 무늬(map) 있는 BackSide 공(반지름 ≥ min(500, far/2), far 안쪽 — W-0294)
//   pbr     = MeshStandard/Physical 재질 중 map·normalMap·roughnessMap 있는 것 ≥ 1
// 결과: 콘솔 표 + results/pw-gfx.json + shots/gfx/<판>.png + shots/gfx/compare.png(다섯 장 가로). 판정은 "빠진 필수 칸 수"(WARN 용).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { chromeArgs, gpuInfo } from './cdp.mjs';
let GFX_GPU = null;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.PW_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argv = process.argv.slice(2);
const bi = argv.indexOf('--base');
const BASE = (bi >= 0 ? argv[bi + 1] : (process.env.PW_BASE || 'http://127.0.0.1:8871/')).replace(/\/?$/, '/');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base' && argv[i - 1] !== '--tune');
/* --tune 키=값 (여러 번) — 판마다 HIGH 손잡이 뒤에 덧붙인다. 같은 장면을 손잡이 하나만 바꿔 A/B 촬영할 때(W-0295) */
const EXTRA = argv.map((a, i) => (a === '--tune' ? argv[i + 1] : null)).filter(Boolean).map((kv) => { const j = kv.indexOf('='), v = kv.slice(j + 1); return [kv.slice(0, j), /^-?\d+(\.\d+)?$/.test(v) ? +v : v]; });
const BL = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'shared', 'gfx-baseline.json'), 'utf8'));
const SHOTS = path.join(HERE, 'shots', 'gfx');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 기준선은 가장 좋은 품질에서 비교한다 — 헤드리스는 자동이면 LOW 로 떨어진다. 계정 만든 직후(다시 불러오기 전) 판별 손잡이를 높음으로 */
const HIGH = {
  'saga-go': [['perf.startTier', 'HIGH'], ['perf.auto', 0]],
  'saga-dungeon': [['dg3d.quality', 'high']],
  'saga-forest': [['village3d.quality', 'high'], ['village3d.on', 1]],
  'saga-story': [],
  'saga-realm': [['realm3d.on', 1], ['realm3d.quality', 'high']]
};
/* 판별 들어가서 3D 켜기 */
const ENTER = {
  'saga-go': async (p) => { await p.evaluate(() => { if (DG.weather && DG.weather.force) { DG.weather.force('clear'); }   /* W-0277 — 비·눈·안개면 그린 하늘을 일부러 끈다(W-0294 설계) → 기준선은 맑음으로 고정해 잰다 */ for (let i = 0; i < 4 && DG.world.tiltMode !== 2; i++) { document.getElementById('btn-tilt') && document.getElementById('btn-tilt').click(); } }); },
  'saga-dungeon': async (p) => { await p.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3500); },
  'saga-forest': async (p) => { await p.evaluate(() => { const V = DG.villageView3d; if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); },
  'saga-story': async (p) => { await p.evaluate(() => { const S = DG.side, C = DG.core; if (!C.save.party.length && DG.hero && DG.hero.recruit) { const h = DG.data.heroes.filter((x) => x.rarity <= 2)[0]; if (h) { DG.hero.recruit(h.id); } } const st = S.stages().map((x) => x.ref).filter((s) => !s.town)[0]; if (st) { S.enter(st.key); } const V = DG.sideView3d; if (V && V.setQuality) { V.setQuality('high'); } if (V && V.available && V.available() && !V.active()) { V.toggle(); } }); await sleep(2500); },
  'saga-realm': async (p) => { await p.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200); await p.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(4000); }
};

async function clearIntro(p) {
  for (let i = 0; i < 12; i++) {
    const open = await p.evaluate(() => !!((window.DG && DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (window.DG && DG.story && DG.story.isOpen && DG.story.isOpen())));
    if (!open) { break; }
    await p.evaluate(() => { if (DG.scenario && DG.scenario.skip) { DG.scenario.skip(); } else if (DG.story && DG.story.skip) { DG.story.skip(); } }); await sleep(250);
  }
  await p.evaluate(() => {
    document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } });
    const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); }
    const mg = document.getElementById('menu-grid'); if (mg) { mg.classList.remove('show'); }
  });
}

/** 페이지 안 — 렌더 가로채기 + 재기 */
const MEASURE = async () => {
  const T = window.THREE; if (!T || !T.WebGLRenderer) { return { err: 'THREE 없음' }; }
  const seen = new Map(), farOf = new Map(); let rdr = null, targets = 0, calls = 0;
  /* WebGLRenderer.render 는 생성자에서 인스턴스마다 붙어 원형을 바꿔도 안 걸린다 → 장면마다 부르는 onBeforeRender(원형)를 가로챈다 */
  const P0 = T.Object3D.prototype, orig = P0.onBeforeRender;
  P0.onBeforeRender = function (renderer, scene, cam, target) { if (this.isScene) { calls++; rdr = renderer; if (target) { targets++; } seen.set(this, (seen.get(this) || 0) + 1); if (cam && cam.far) { farOf.set(this, Math.max(farOf.get(this) || 0, cam.far)); } } return orig.apply(this, arguments); };
  await new Promise((r) => setTimeout(r, 1500));
  P0.onBeforeRender = orig;
  if (!rdr) { return { err: '그린 프레임 없음', calls }; }
  /* 가장 큰 장면(=게임 세계) */
  let scene = null, best = -1;
  for (const s of seen.keys()) { let n = 0; s.traverse(() => { n++; }); if (n > best) { best = n; scene = s; } }
  const r = { calls, targets, objects: best, toon: 0, cast: 0, sun: 0, sky: 0, pbr: 0, std: 0 };
  const mats = new Set();
  scene.traverse((o) => {
    if (o.isDirectionalLight) { r.sun++; }
    if (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) {
      if (o.castShadow && o.visible) { r.cast++; }
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (m) { mats.add(m); } });
      const g = o.geometry; if (o.material && o.material.side === T.BackSide && g) { if (!g.boundingSphere) { g.computeBoundingSphere(); } const far = farOf.get(scene) || 1000, rad = g.boundingSphere ? g.boundingSphere.radius * Math.max(o.scale.x, 1) : 0; if (o.visible && o.material.map && rad >= Math.min(500, far * 0.5) && rad < far) { r.sky++; } }   // W-0294 그린 하늘 공(무늬 있는 안쪽 면 공, 카메라 far 안쪽) — 옛 기준(반지름 500)은 far 400 인 3마을 공을 못 셌고 무늬 없는 그라디언트도 셌다
    }
  });
  mats.forEach((m) => {
    if (m.isMeshToonMaterial || (m.userData && (m.userData.toon || m.userData.toonRim)) || (m.onBeforeCompile && String(m.onBeforeCompile).length > 40)) { r.toon++; }
    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) { r.std++; if (m.map || m.normalMap || m.roughnessMap) { r.pbr++; } }
  });
  if (scene.background && (scene.background.isTexture || scene.background.isCubeTexture)) { r.sky++; }
  const P = window.DG && DG.post3d, A = window.DG && DG.ssao3d;
  const ps = P && P.stats ? P.stats() : null, as = A && A.stats ? A.stats() : null;
  r.toneMapping = rdr.toneMapping; r.shadowMap = !!(rdr.shadowMap && rdr.shadowMap.enabled);
  r.postStats = ps; r.ssaoStats = as;
  r.has = {
    toon: r.toon > 0,
    tonemap: rdr.toneMapping !== 0,
    post: !!(P && P.available && P.available()) && (targets > 0 || !!(ps && (ps.drawn || ps.frames || ps.passes))),
    ssao: !!(A && A.available && A.available()) && !!(as && (as.drawn || as.frames || as.on)),
    shadow: r.shadowMap && r.cast >= 3,
    sun: r.sun > 0,
    sky: r.sky > 0,
    pbr: r.pbr > 0
  };
  return r;
};

async function one(browser, g) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (e) { /* 없어도 된다 */ }
  const url = BASE + g + '/';
  let m = null, err = '';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
    await page.evaluate((hi) => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('그래픽'); hi.forEach(([k, v]) => DG.core.setTune(k, v)); }, HIGH[g].concat(EXTRA));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await clearIntro(page);
    await ENTER[g](page); await clearIntro(page);
    await sleep(6000); await clearIntro(page);
    m = await page.evaluate(MEASURE);
    await page.screenshot({ path: path.join(SHOTS, g + '.png') });
  } catch (e) { err = e.message.slice(0, 200); }
  await ctx.close();
  const res = { game: g, err: err || (m && m.err) || '', m, rows: [] };
  for (const f of BL.features) {
    const need = f.need[g];
    const na = typeof need === 'string' && need.startsWith('na');
    const ok = !!(m && m.has && m.has[f.id]);
    res.rows.push({ id: f.id, name: f.name, na, ok, ticket: f.ticket || null });
  }
  res.missing = res.rows.filter((r) => !r.na && !r.ok).map((r) => r.id);
  return res;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: chromeArgs() });   // W-0314 기본 실제 GPU(PW_GPU=0 이면 swiftshader)
{ const p0 = await browser.newPage(); GFX_GPU = await gpuInfo(p0); await p0.close(); }
const out = [];
try {
  for (const g of (games.length ? games : ALL)) {
    const r = await one(browser, g); out.push(r);
    console.log(`${r.missing.length ? 'WARN' : 'OK  '} ${g} · ` + r.rows.map((x) => (x.na ? '–' : x.ok ? '○' : '×') + x.id).join(' ') + (r.err ? ' · ERR ' + r.err : '') + (r.m && !r.m.err ? ` · 그리기 ${r.m.calls} · 대상 ${r.m.targets} · 그림자 메시 ${r.m.cast} · 표준 재질 ${r.m.std}` : ''));
  }
  /* 다섯 장 가로 비교 */
  const imgs = out.filter((r) => fs.existsSync(path.join(SHOTS, r.game + '.png')));
  if (imgs.length) {
    const ctx = await browser.newContext({ viewport: { width: 640 * imgs.length, height: 400 } });
    const p = await ctx.newPage();
    const html = '<body style="margin:0;background:#111;display:flex">' + imgs.map((r) => `<div style="width:640px;position:relative"><img style="width:640px;height:360px;display:block" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, r.game + '.png')).toString('base64')}"><div style="color:#eee;font:14px sans-serif;padding:8px">${r.game} · 빠짐 ${r.missing.join(',') || '없음'}</div></div>`).join('') + '</body>';
    await p.setContent(html); await sleep(300);
    await p.screenshot({ path: path.join(SHOTS, 'compare.png') });
    await ctx.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(HERE, 'results', 'pw-gfx.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, gpu: GFX_GPU, runs: out }, null, 1));
const miss = out.reduce((a, r) => a + r.missing.length, 0);
console.log(`PW-GFX 빠진 칸 ${miss} / 판 ${out.length}`);
process.exit(0);
