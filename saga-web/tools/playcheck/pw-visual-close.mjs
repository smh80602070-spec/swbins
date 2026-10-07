// 웹 3D 그림 확인 닫기(W-0099) — 사가고·사가블로·사가의숲·사가스토리의 3D 그림·연출 기능을 장면마다 실제로 띄워 한 장씩 찍는다.
//   node pw-visual-close.mjs [판 …]      (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 장면마다 1280×720 PNG(shots/visual-20261007/, 커밋 안 함) + 그림 지표(그리기 호출·삼각형 등 판이 내주는 것) + 화소 지표
// (축소본 밝기 표준편차·색 칸 수 — 단색/빈 화면이면 실패). 판정(○△×)은 Claude 가 PNG 를 직접 보고 시트(tasks/sheets/web-visual-*.md)에 적는다.
// fs.auto·fs.admin 은 같은 스크립트의 기계 확인 한 줄씩. Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// 결과는 콘솔 + results/pw-visual-close.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const SHOTS = 'shots/visual-20261007';
fs.mkdirSync(SHOTS, { recursive: true });
const want = process.argv.slice(2);
const results = [], rows = [], scenes = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const realErrors = (errs) => errs.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|tile\.openstreetmap|overpass/i.test(e));

/** 찍고 화소를 잰다 — 축소본(160×90)의 밝기 표준편차와 4비트 색 칸 수. 단색·빈 화면이면 std 가 거의 0 이다 */
async function shoot(r, game, key, title, feats, metrics) {
  const file = SHOTS + '/' + game + '-' + key + '.png';
  const buf = await r.page.screenshot({ path: file });
  const px = await r.page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = 160; c.height = 90;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 160, 90);
    const d = g.getImageData(0, 0, 160, 90).data, bins = {};
    let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; n++; bins[(d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)] = 1; }
    const mean = s / n;
    return { mean: +mean.toFixed(1), std: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(1), bins: Object.keys(bins).length };
  }, buf.toString('base64'));
  const row = { game, key, title, feats, file, px, metrics: metrics || null };
  scenes.push(row);
  check('장면 ' + game + ' ' + key + ' ' + title + ' — 화면이 단색이 아니다', px.std >= 8 && px.bins >= 12, JSON.stringify({ px, metrics }));
  return row;
}

async function boot(r, { title = true } = {}) {
  const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await r.page.goto(r.url('index.html')); await sleep(3000);
  if (title) { await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } }); }
  await sleep(4000);
}
async function skipScenes(r, isOpen) {
  for (let i = 0; i < 12 && await r.page.evaluate(isOpen); i++) { await r.page.keyboard.press('Escape'); await sleep(250); }
}
/** 초상 판 — 영웅 6·펫 몇을 굽게 하고 다 구워진 그림을 한 판에 늘어놓는다(화면 위에 덮어 찍고 치운다) */
async function portraitBoard(r) {
  return r.page.evaluate(async () => {
    const P3 = DG.portrait3d, D = DG.data || {};
    const heroes = (D.heroes || []).slice(0, 8).map((h) => ['hero', h]);
    const pets = (D.pets || []).filter((p) => !P3.supports || P3.supports('pet', p)).slice(0, 4).map((p) => ['pet', p]);
    const items = heroes.concat(pets);
    items.forEach(([k, ref]) => { try { P3.warm(k, ref, 128, 128); } catch (e) { /* 못 굽는 종은 건너뛴다 */ } });
    const t0 = Date.now();
    while (Date.now() - t0 < 40000 && items.some(([k, ref]) => !P3.of(k, ref, 128, 128))) { await new Promise((ok) => setTimeout(ok, 500)); }
    const board = document.createElement('div'); board.id = 'pw-portrait-board';
    board.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#20242c;display:flex;flex-wrap:wrap;gap:10px;padding:16px;align-content:flex-start;color:#ddd;font:12px sans-serif';
    let got = 0;
    items.forEach(([k, ref]) => {
      const src = P3.of(k, ref, 128, 128); if (src) { got++; }
      const cell = document.createElement('div'); cell.style.cssText = 'width:140px;text-align:center';
      cell.innerHTML = (src ? '<img src="' + src + '" style="width:128px;height:128px;background:#333">' : '<div style="width:128px;height:128px;background:#522;line-height:128px">없음</div>') + '<div>' + k + ' ' + (ref.name || ref.id) + '</div>';
      board.appendChild(cell);
    });
    document.body.appendChild(board);
    await new Promise((ok) => setTimeout(ok, 800));
    return { asked: items.length, got, stats: P3.stats ? P3.stats() : null };
  });
}
const clearBoard = (r) => r.page.evaluate(() => { const b = document.getElementById('pw-portrait-board'); if (b) { b.remove(); } });

/* ───────────── 사가고 ───────────── */
async function runGo() {
  const r = await open('saga-go'); const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.addInitScript(SEED);
  try {
    await boot(r);
    await skipScenes(r, () => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()));
    await ev(() => { DG.core.setTune('world3d.dayNight', 0); });
    for (let i = 0; i < 4 && await ev(() => DG.world.tiltMode !== 2); i++) { await ev(() => document.getElementById('btn-tilt').click()); await sleep(600); }
    await sleep(3000);
    const gl = () => ev(() => ({ on: !!(DG.world3d.active && DG.world3d.active()), tilt: DG.world.tiltMode, gl: DG.world3d.glInfo ? DG.world3d.glInfo() : null, me: DG.world3d.actorPos('me') ? { visible: DG.world3d.actorPos('me').visible } : null }));
    await shoot(r, 'saga-go', '1-world3d', '마을 3D(등 뒤 카메라)', ['go.world3d', 'go.asset3d'], await gl());
    /* 인물 가까이 — 화면 가운데에서 휠로 당긴다 */
    await r.page.mouse.move(640, 380);
    for (let i = 0; i < 8; i++) { await r.page.mouse.wheel(0, -300); await sleep(120); }
    await sleep(1500);
    await shoot(r, 'saga-go', '2-close', '인물 가까이(휠로 당김)', ['go.asset3d', 'go.world3d'], Object.assign(await gl(), { zoom: await ev(() => DG.world.zoom3d) }));
    for (let i = 0; i < 8; i++) { await r.page.mouse.wheel(0, 300); await sleep(80); }
    /* 결투 + 전투 연출 알갱이 — 결투 화면을 열고, 그 위에서 battle3d 알갱이(검기·불꽃·흙먼지)를 터뜨린 직후 */
    await ev(() => { DG.duel.open({ title: '시험 결투', foeHp: 3000, myAtk: 80, myDef: 500, foeName: '시험', onDone: function () {} }); }); await sleep(1200);
    await shoot(r, 'saga-go', '3-duel', '결투(실시간 전투) 화면', ['go.rogue-action'], await gl());
    await ev(() => { document.querySelector('[data-d="flee"]') && document.querySelector('[data-d="flee"]').click(); }); await sleep(1500);
    await ev(() => { const o = document.querySelector('.duel-ok, #duel-ok, [data-d="ok"]'); if (o) { o.click(); } }); await sleep(1200);
    const b = await ev(() => { const B = DG.battle3d, s = B.spot(); return { n: B.burst(s.x, s.z, 'flame') + B.burst(s.x, s.z, 'slash') + B.burst(s.x, s.z, 'dust'), on: B.on() }; });
    await sleep(150);
    await shoot(r, 'saga-go', '4-burst', '전투 연출 알갱이(불꽃·검기·흙먼지)', ['go.battle3d'], Object.assign(await gl(), { burst: b, stats: await ev(() => DG.battle3d.stats()) }));
    /* 2D 로 되돌림 */
    await ev(() => { DG.core.setTune('world.render3d', 0); }); await sleep(2500);
    await shoot(r, 'saga-go', '5-2d', '3D 끔(2D 캔버스로 되돌림)', ['go.world3d'], await gl());
    await ev(() => { DG.core.setTune('world.render3d', 1); });
  } catch (e) { check('사가고 예외 — ' + e.message.slice(0, 200), false); }
  const real = realErrors(r.errors);
  check('사가고 페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
  await r.close();
}

/* ───────────── 사가블로 ───────────── */
async function runDungeon() {
  const r = await open('saga-dungeon'); const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.addInitScript(SEED);
  const isOpen = () => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen());
  /* 장면 속 몸(배우·장애물)의 상태 세기 — 효과 묶음의 부모가 곧 장면이라 빈 노드를 잠깐 붙여 부모를 얻고 뗀다(읽기만) */
  const BODIES = () => { var n = new (DG.dungeon3d.three().Object3D)(); DG.dungeon3d.addFx(n); var sc = n.parent, c = { glb: 0, shape: 0, fail: 0 }; if (n.parent) { n.parent.remove(n); } while (sc && sc.parent) { sc = sc.parent; } if (sc) { sc.traverse(function (o) { var k = o.userData && o.userData.assetState; if (k && c[k] !== undefined && o.visible) { c[k]++; } }); } return c; };
  await r.page.addInitScript((src) => { window.__bodies = new Function('return (' + src + ')()'); }, BODIES.toString());
  /* 몸은 프레임당 하나씩 조립된다(asset3d heavyQ) — 헤드리스(약 6fps)에선 첫 방 70몸이 50초쯤 걸린다. 도형이 0 이 될 때까지 기다린다(최대 75초) */
  const settle = async () => { for (let i = 0; i < 75; i++) { const c = await ev(() => window.__bodies()); if (c.shape === 0) { return c; } await sleep(1000); } return ev(() => window.__bodies()); };
  const st = () => ev(() => ({ s: DG.dungeon3d.stats ? DG.dungeon3d.stats() : null, active: DG.dungeon3d.active(), me: DG.dungeon3d.meBody(), look: DG.dungeon3d._meLookOf ? DG.dungeon3d._meLookOf() : null, bodies: window.__bodies() }));
  const enter = async () => { const ok = await ev(() => { if (DG.town) { DG.town.leave(); } return DG.dungeon.enter({ floor: 1 }); }); await sleep(2500); await skipScenes(r, isOpen); return ok !== false && await ev(() => DG.dungeon.active()); };
  try {
    await boot(r, { title: false });
    await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    const cells = r.page.locator('#starter-host .stc-cell');
    for (let i = 0; i < 3; i++) { await cells.nth(i).click(); await sleep(150); }
    await r.page.locator('#starter-host .stc-btn').first().click(); await sleep(1500);
    await skipScenes(r, isOpen);
    await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } });
    await sleep(2500);
    await shoot(r, 'saga-dungeon', '1-town', '오픈월드 마을·들판 3D', ['dg.dungeon3d'], await st());
    check('사가블로 굴혈에 들어간다', await enter());
    await settle();
    const before = await st();
    await shoot(r, 'saga-dungeon', '2-room', '던전 첫 방 3D(장비 없음)', ['dg.dungeon3d', 'dg.dungeon3d-2'], before);
    /* 문 통로 — 방을 비우고 문으로 넘어간 직후(위장 전환)와 다 넘어간 뒤 */
    const door = await ev(() => { var R = DG.dungeon.raw(); R.room.enemies.forEach((e) => { e.hp = 0; e.dead = true; }); R.room.cleared = true; var d = (R.room.doors || [])[0]; var k = d ? d.kind : 'fight'; var idx = R.roomIdx; DG.dungeon.goRoom(k); return { kind: k, doors: (R.room.doors || []).length, from: idx, to: DG.dungeon.raw().roomIdx }; });
    await sleep(250);
    await shoot(r, 'saga-dungeon', '3-door', '문 통로 넘어가는 중(' + door.kind + ')', ['dg.dungeon-2'], Object.assign(await st(), { door }));
    await settle();
    await shoot(r, 'saga-dungeon', '4-next', '다음 방 도착', ['dg.dungeon-2', 'dg.dungeon3d'], await st());
    /* 장비 → 겉모습 — 명품 한 벌 프리셋 뒤 같은 첫 방, 휠로 당겨 몸을 본다 */
    await r.page.goto(r.url('_admin.html')); await sleep(2000);
    await r.page.locator('[data-tab="preset"]').click(); await sleep(300);
    await r.page.locator('#presets .preset', { hasText: '⚔️ 명품 한 벌 갖춘 판' }).click(); await sleep(600);
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await skipScenes(r, isOpen);
    check('사가블로 프리셋 뒤 굴혈에 들어간다', await enter());
    await ev(() => { DG.dungeon3d.refreshMe(); }); await sleep(1000);
    /* 다시 지은 몸이 GLB 로 설 때까지(최대 30초) — 그동안은 도형 몸(shape)이 자리를 지킨다 */
    for (let i = 0; i < 60 && await ev(() => { var b = DG.dungeon3d.meBody(); return !(b && b.state === 'glb'); }); i++) { await sleep(500); }
    await r.page.mouse.move(640, 360);
    for (let i = 0; i < 6; i++) { await r.page.mouse.wheel(0, -300); await sleep(120); }
    await settle();
    const after = await st();
    await shoot(r, 'saga-dungeon', '5-gear', '명품 한 벌 입은 몸(휠로 당김)', ['dg.dungeon3d-2'], after);
    check('사가블로 장비를 입으면 겉모습 값이 바뀐다(무기·투구·갑주 look)', JSON.stringify(before.look) !== JSON.stringify(after.look), JSON.stringify({ before: before.look, after: after.look }));
  } catch (e) { check('사가블로 예외 — ' + e.message.slice(0, 200), false); }
  const real = realErrors(r.errors);
  check('사가블로 페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
  await r.close();
}

/* ───────────── 사가의숲 ───────────── */
async function runForest() {
  const r = await open('saga-forest'); const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.addInitScript(SEED);
  const st = () => ev(() => { var V = DG.villageView3d; return { active: V.active(), inst: V.instMeshCount(), scatter: V.scatterCount(), indoors: DG.village.indoors() }; });
  try {
    await boot(r);
    await skipScenes(r, () => !!(DG.scenario && DG.scenario.isOpen()));
    await ev(() => { var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
    await ev(() => { DG.core.setTune('village3d.on', 1); }); await sleep(3500);
    await shoot(r, 'saga-forest', '1-village3d', '3D 마을', ['fs.village-view3d', 'fs.asset3d'], await st());
    await ev(() => { DG.core.setTune('village3d.on', 0); }); await sleep(2000);
    await shoot(r, 'saga-forest', '2-sphere2d', '2D 구면 투영 마을', ['fs.village-view'], await st());
    await ev(() => DG.village.enterHome()); await sleep(1500);
    await shoot(r, 'saga-forest', '3-home', '집 안 평면(안 휨)', ['fs.village-view'], await st());
    await ev(() => DG.village.leaveHome()); await sleep(500);
    await ev(() => { DG.core.setTune('village3d.on', 1); }); await sleep(1500);
    const pb = await portraitBoard(r);
    await shoot(r, 'saga-forest', '4-portrait', '3D 초상 판(영웅·펫)', ['fs.portrait3d', 'fs.asset3d'], pb);
    check('사가의숲 초상 — 굽기를 청한 것 중 반 넘게 그림이 나온다', pb.got > 0 && pb.got * 2 >= pb.asked, JSON.stringify(pb));
    await clearBoard(r);
    /* fs.auto — 🤖 단추로 켜면 스스로 할 일을 잡고, 다시 누르면 꺼진다 */
    const a0 = await ev(() => DG.auto.status().on);
    await ev(() => document.getElementById('btn-auto').click()); await sleep(3000);
    const a1 = await ev(() => { var s = DG.auto.status(); return { on: s.on, doing: s.doing }; });
    await ev(() => document.getElementById('btn-auto').click()); await sleep(300);
    const a2 = await ev(() => DG.auto.status().on);
    check('fs.auto 자동 순행 — 🤖 단추로 켜면 스스로 할 일을 잡고(doing), 다시 누르면 꺼진다', !a0 && a1.on && !!a1.doing && !a2, JSON.stringify({ a0, a1, a2 }));
  } catch (e) { check('사가의숲 예외 — ' + e.message.slice(0, 200), false); }
  const real = realErrors(r.errors);
  check('사가의숲 페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
  await r.close();

  /* fs.admin — 🔍 점검이 "모두 통과", 프리셋 단추로 세이브가 바뀐다 */
  const a = await open('saga-forest');
  try {
    const aev = (fn, arg) => a.page.evaluate(fn, arg);
    await a.page.goto(a.url('index.html')); await sleep(1500);
    await aev(() => { DG.account.create('어드민'); });
    await a.page.goto(a.url('_admin.html')); await sleep(2500);
    await aev(() => document.getElementById('selftest').click()); await sleep(2500);
    const out = await aev(() => (document.getElementById('selfout') || {}).textContent || '');
    const k0 = await aev(() => DG.account.keyOf(DG.account.current().id)), before = await aev((k) => localStorage.getItem(k) || '', k0);
    await a.page.locator('[data-tab="preset"]').click().catch(() => {}); await sleep(300);
    const np = await a.page.locator('.preset').count();
    await a.page.locator('.preset').last().click(); await sleep(800);
    const after = await aev((k) => localStorage.getItem(k) || '', k0);
    check('fs.admin 어드민 — 🔍 점검이 모두 통과, 프리셋 단추를 누르면 세이브가 바뀐다', /모두 통과/.test(out) && np > 0 && after.length > 0 && after !== before, JSON.stringify({ out: out.slice(0, 60), presets: np, changed: after !== before }));
    const real2 = realErrors(a.errors);
    check('사가의숲 어드민 페이지 예외 없음', real2.length === 0, real2.slice(0, 2).join(' | '));
  } catch (e) { check('사가의숲 어드민 예외 — ' + e.message.slice(0, 200), false); }
  await a.close();
}

/* ───────────── 사가스토리 ───────────── */
async function runStory() {
  const r = await open('saga-story'); const ev = (fn, arg) => r.page.evaluate(fn, arg);
  await r.page.addInitScript(SEED);
  const isOpen = () => !!(DG.story && DG.story.isOpen && DG.story.isOpen());
  const st = () => ev(() => ({ active: DG.sideView3d.active(), q: DG.sideView3d.quality(), level: DG.sideView3d.effectiveLevel(), post: DG.post3d.stats(), stage: DG.side.raw().stage.key }));
  try {
    await boot(r);
    await skipScenes(r, isOpen);
    await ev(() => { if (!DG.sideView3d.active()) { DG.sideView3d.toggle(); } DG.sideView3d.setQuality('high'); }); await sleep(2500);
    await shoot(r, 'saga-story', '1-town', '마을 3D 배경(HIGH)', ['st.side-view3d', 'st.asset3d'], await st());
    const k = await ev(() => { var s = (DG.sideData.STAGES || []).find((x) => !x.town); DG.side.travel(s.key) || DG.side.enter(s.key); return s.key; });
    await sleep(3000); await skipScenes(r, isOpen);
    await shoot(r, 'saga-story', '2-field-high', '첫 사냥터 3D(HIGH 후처리)', ['st.side-view3d', 'st.asset3d', 'st.post3d'], Object.assign(await st(), { k }));
    await ev(() => { DG.sideView3d.setQuality('low'); }); await sleep(2500);
    await shoot(r, 'saga-story', '3-field-low', '같은 사냥터(LOW 후처리)', ['st.post3d'], await st());
    await ev(() => { DG.sideView3d.setQuality('auto'); });
    const pb = await portraitBoard(r);
    await shoot(r, 'saga-story', '4-portrait', '3D 초상 판(영웅·사슴·구미호)', ['st.portrait3d'], pb);
    check('사가스토리 초상 — 굽기를 청한 것 중 반 넘게 그림이 나온다', pb.got > 0 && pb.got * 2 >= pb.asked, JSON.stringify(pb));
    await clearBoard(r);
  } catch (e) { check('사가스토리 예외 — ' + e.message.slice(0, 200), false); }
  const real = realErrors(r.errors);
  check('사가스토리 페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
  await r.close();
}

const RUN = { 'saga-go': runGo, 'saga-dungeon': runDungeon, 'saga-forest': runForest, 'saga-story': runStory };
for (const g of Object.keys(RUN)) { if (!want.length || want.includes(g)) { await RUN[g](); } }
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-visual-close.json', JSON.stringify({ script: 'pw-visual-close.mjs', pass: results.filter(Boolean).length, total: results.length, scenes, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
