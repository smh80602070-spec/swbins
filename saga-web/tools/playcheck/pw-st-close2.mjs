// 사가스토리 확인 닫기 ②(W-0097) — 계정 이어받기·적 표/유형·UI 설정·어드민을 실제 판에서 한 번씩 해 본다.
//   node pw-st-close2.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면: ⚙️ 설정 시트 `snd-toggle`·`vib-toggle`·`snd-vol` · ⛶ #btn-focus · 어드민 `_admin.html?selftest`·프리셋 단추.
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-st-close2.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-story');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const skipScenes = async () => { for (let i = 0; i < 12 && await ev(() => !!(DG.story && DG.story.isOpen && DG.story.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);

try {
  /* st.account — 옛 세이브(…/save/v1)를 이어받아 새 프로필을 만든다 */
  await page.goto(r.url('index.html')); await sleep(1500);
  const ac0 = await ev(() => {
    var base = DG.core.SAVE_BASE, legacy = base + '/v1', s = JSON.parse(JSON.stringify(DG.core.save));
    s.player = s.player || {}; s.player.gold = 4321; localStorage.setItem(legacy, JSON.stringify(s));
    var acc = DG.account.create('확인', true);
    return { base: base, legacy: legacy, id: acc.id, key: DG.account.keyOf(acc.id), hadLegacy: DG.account.hasLegacy(), copied: localStorage.getItem(DG.account.keyOf(acc.id)) === localStorage.getItem(legacy) };
  });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(4000);
  await skipScenes();
  const ac1 = await ev((a) => ({ gold: DG.core.save.player.gold, keyHas: !!localStorage.getItem(a.key), legacyKept: !!localStorage.getItem(a.legacy), cur: DG.account.current().id }), ac0);
  const ac2 = await ev(() => { var b = DG.account.create('둘째'), k = DG.account.keyOf(b.id); return { id: b.id, key: k, n: DG.account.list().length }; });
  check('st.account 계정 — 옛 세이브를 이어받아 만든 프로필은 키 yeoksa-side/save/<프로필> 에 옛 세이브 원문이 그대로 옮겨지고(들어가면 금 4321 에서 이어감), 옛 키는 남으며, 둘째 프로필은 키가 다르다',
    ac0.base === 'yeoksa-side/save' && ac0.key === 'yeoksa-side/save/' + ac0.id && ac0.hadLegacy && ac0.copied && ac1.gold >= 4321 && ac1.keyHas && ac1.legacyKept && ac1.cur === ac0.id && ac2.key !== ac0.key && ac2.n === 2,
    JSON.stringify({ ac0, ac1, ac2 }));
  await ev((id) => { DG.account.use(id); }, ac0.id);

  /* st.data-enemy — 표·현대/미래 적, 사냥터 여러 곳에서 적을 세우면 유형 다섯 · 원거리는 든 무기가 원거리 */
  const en = await ev(() => {
    var E = DG.enemyData, SD = DG.sideData, es = E.enemies, bs = E.bosses, roles = {}, rangedOk = true, stages = SD.STAGES.filter((s) => !s.town).map((s) => s.key), tried = [];
    DG.core.save.player.level = 90;
    stages.forEach((k) => {
      if (!DG.side.enter(k) && !(DG.side.active() && DG.side.raw().stage.key === k)) { return; }
      tried.push(k);
      for (var i = 0; i < 25; i++) {
        var e = DG.side.spawnEnemy(200 + i * 30);
        if (!e) { continue; }
        roles[e.role] = (roles[e.role] || 0) + 1;
        if (e.role === 'ranged' && !(e.ref && SD.rangedOf(e.ref))) { rangedOk = false; }
      }
    });
    return { mobs: es.length, bosses: bs.length, tiers: Array.from(new Set(es.map((e) => e.tier))).sort(), era: SD.ERA_ENEMIES.length, roles: roles, rangedOk: rangedOk, stages: tried.length };
  });
  const five = ['melee', 'ranged', 'dash', 'tank', 'magic'];
  check('st.data-enemy 적 — 잡졸·보스 표(tier 1~4)·현대/미래 적, 사냥터 여러 곳에서 세운 적에 유형 다섯(근접·원거리·돌진·탱커·마법)이 다 나오고 원거리는 든 무기가 원거리',
    en.mobs >= 32 && en.bosses >= 10 && JSON.stringify(en.tiers) === '[1,2,3,4]' && en.era >= 8 && five.every((k) => en.roles[k] > 0) && en.rangedOk, JSON.stringify(en));
  await ev(() => { DG.side.enter('field'); }); await sleep(800); await skipScenes();   // ⛶ 는 사냥터 화면에서만 보인다

  /* st.ui — ⚙️ 설정 시트 단추·음량 막대, ⛶ 도구줄 감추기 */
  await ev(() => { DG.ui.openSheet('settings'); }); await sleep(500);
  const u0 = await ev(() => ({ snd: DG.sfx.enabled(), vib: DG.sfx.vibrateEnabled() }));
  const vol = page.locator('#sheet-body [data-act="snd-vol"]');   // 소리를 끄면 음량 막대가 잠긴다 — 막대를 먼저
  if (await vol.count()) { await vol.fill('20'); await sleep(200); }
  const c1 = await domClick('#sheet-body [data-act="snd-toggle"]'); await sleep(200);
  const c2 = await domClick('#sheet-body [data-act="vib-toggle"]'); await sleep(200);
  const u1 = await ev(() => ({ snd: DG.sfx.enabled(), vib: DG.sfx.vibrateEnabled(), vol: DG.sfx.volume() }));
  await ev((u) => { DG.sfx.setEnabled(u.snd); DG.sfx.setVibrateEnabled(u.vib); DG.ui.closeSheet(); }, u0);
  await page.locator('#btn-focus').click(); await sleep(300);
  const f1 = await ev(() => document.body.classList.contains('focus'));
  await page.locator('#btn-focus').click(); await sleep(300);
  const f2 = await ev(() => document.body.classList.contains('focus'));
  check('st.ui 화면 — 설정 시트 효과음·진동 단추로 켜짐이 뒤집히고 음량 막대가 음량을 바꾸며, ⛶ 를 누르면 도구줄이 감춰졌다 다시 누르면 돌아온다',
    c1 && c2 && u1.snd === !u0.snd && u1.vib === !u0.vib && Math.abs(u1.vol - 0.2) < 0.01 && f1 && !f2, JSON.stringify({ u0, u1, f1, f2 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }
const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
await r.close();

/* st.admin — 어드민 자가점검(?selftest → 제목 ADMIN n/n)·손잡이 8·프리셋 단추로 세이브가 바뀐다 */
const a = await open('saga-story');
try {
  const ap = a.page, aev = (fn, arg) => ap.evaluate(fn, arg);
  await ap.goto(a.url('index.html')); await sleep(1500);
  await aev(() => { DG.account.create('어드민'); });
  await ap.goto(a.url('_admin.html?selftest')); await sleep(3000);
  const title = await ap.title();
  const ad = await aev(() => ({ knobs: (DG.admin && DG.admin.KNOBS || []).length, presets: document.querySelectorAll('#presets .preset').length }));
  const curKey = () => aev(() => DG.account.keyOf(DG.account.current().id));
  const k0 = await curKey(), before = await aev((k) => localStorage.getItem(k) || '', k0);
  await ap.locator('[data-tab="preset"]').click().catch(() => {}); await sleep(300);
  /* 맨 앞 프리셋은 "새 판"이라 갓 만든 세이브와 같다 — 레벨·금이 바뀌는 쪽(맨 뒤)을 누른다 */
  await ap.locator('#presets .preset').last().click(); await sleep(800);
  const after = await aev((k) => localStorage.getItem(k) || '', k0);
  const m = /ADMIN (\d+)\/(\d+)/.exec(title);
  check('st.admin 어드민 — ?selftest 제목이 ADMIN n/n(실패 0), 손잡이 8 이상(지금 17), 프리셋 단추를 누르면 세이브가 바뀐다',
    !!m && m[1] === m[2] && +m[2] > 0 && ad.knobs >= 8 && ad.presets > 0 && after.length > 0 && after !== before, JSON.stringify({ title, ad, changed: after !== before }));
} catch (e) { check('어드민 예외 — ' + e.message.slice(0, 200), false); }
const realA = a.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
await a.close();
check('페이지 예외·console.error 없음', real.length === 0 && realA.length === 0, real.concat(realA).slice(0, 2).join(' | '));
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-st-close2.json', JSON.stringify({ script: 'pw-st-close2.mjs', game: 'saga-story', pass: results.filter(Boolean).length, total: results.length, pageErrors: real.concat(realA), checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
