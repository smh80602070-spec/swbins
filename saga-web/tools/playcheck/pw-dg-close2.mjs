// 사가블로 확인 닫기 ②(W-0095) — 출사표·승급·던전 회차·적 도감·퀘스트·소리/진동·계정을 실제 판에서 한 번씩 해 본다.
//   node pw-dg-close2.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면 단추: 출사표 `.stc-cell`·`.stc-btn`(starter.js) · 인물 상세 `[data-act="rankup"]`(ui.js). 프리셋 없이 새 세이브로 출사표부터 본다.
// 헤드리스엔 진동이 없어 navigator.vibrate 를 시작 전에 기록기로 갈아 둔다. Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-dg-close2.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-dungeon');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => {
  let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: function (p) { window.__vib.push(p); return true; } }); } catch (e) { /* 못 갈면 진동 검사에서 드러난다 */ }
});
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }

  /* dg.game — 출사표 칸 셋을 누르고 「출사」 → 부대 셋 · 중복이 쌓이면 인물 상세 「승급」 단추로 한 단·금이 든다 */
  const st0 = await ev(() => { var h = document.getElementById('starter-host'); return { show: !!(h && h.classList.contains('show')), cells: h ? h.querySelectorAll('.stc-cell').length : 0, party: DG.core.save.party.length }; });
  const cells = page.locator('#starter-host .stc-cell');
  for (let i = 0; i < 3 && i < st0.cells; i++) { await cells.nth(i).click(); await sleep(200); }
  const go = page.locator('#starter-host .stc-btn').first();
  const goOk = await go.count() && await go.isEnabled();
  if (goOk) { await go.click(); await sleep(1500); }
  const st1 = await ev(() => ({ party: DG.core.save.party.slice(), shown: !!(document.getElementById('starter-host') && document.getElementById('starter-host').classList.contains('show')) }));
  const rk0 = await ev(() => { var id = DG.core.save.party[0], H = DG.hero, c = H.rankUpCost(H.info(id).rank || 0); DG.core.save.dex.heroes[id].count = 1 + c.dup; DG.core.save.player.gold += c.gold + 50; var g0 = DG.core.save.player.gold; DG.ui.openDetail('hero', id); return { id: id, rank: H.info(id).rank || 0, g0: g0, cost: c }; });
  await sleep(400);
  const rkBtn = await domClick('[data-act="rankup"][data-id="' + rk0.id + '"]'); await sleep(400);
  const rk1 = await ev((id) => ({ rank: DG.hero.info(id).rank || 0, gold: DG.core.save.player.gold, dup: DG.hero.dupOf(id) }), rk0.id);
  await ev(() => { DG.ui.closeDetail(); });
  check('dg.game 출사표·승급 — 출사표 칸 셋을 누르고 「출사」 하면 부대 셋, 중복이 쌓이면 인물 상세 「승급」 단추로 한 단 오르고 금이 든다',
    st0.show && st0.party === 0 && goOk && st1.party.length === 3 && !st1.shown && rkBtn && rk1.rank === rk0.rank + 1 && rk1.gold === rk0.g0 - rk0.cost.gold, JSON.stringify({ st0, goOk, st1, rk0, rkBtn, rk1 }));

  /* dg.dungeon — 난도 셋·처음엔 평만 · 1층 들어가면 회차가 서고 방이 있다 · 역참 5층마다·같은 층 두 번은 거부 · 두목 층 3의 배수 */
  const dn = await ev(() => {
    var D = DG.dungeon, DD = DG.dungeonData, out = { modes: D.MODES.map((m) => m.key), open: D.modesOpen().map((m) => m.key), hard: D.setMode(D.MODES[1].key), every: D.WAYPOINT_EVERY };
    if (DG.town) { DG.town.leave(); }
    out.enter = D.enter({ floor: 1 }) !== false; out.active = D.active();
    var R = D.raw && D.raw(); out.room = !!(R && R.room); out.floor = R ? R.floor : null;
    out.wp1 = D.markWaypoint(5); out.wp2 = D.markWaypoint(5); out.wp = D.waypoint();
    out.boss = [3, 6, 9, 4, 5].map((f) => DD.isBossFloor(f));
    return out;
  });
  check('dg.dungeon 던전 회차 — 난도 셋에 처음엔 평만 열리고(어려움 거부), 1층에 들어가면 회차·방이 서고, 역참은 5층마다·같은 층은 두 번 안 찍히며, 두목 층은 3의 배수',
    dn.modes.length === 3 && dn.open.length === 1 && dn.hard === false && dn.every === 5 && dn.enter && dn.active && dn.room && dn.wp1 !== false && dn.wp2 === false && dn.wp === 5 && JSON.stringify(dn.boss) === '[true,true,true,false,false]', JSON.stringify(dn));

  /* dg.data-enemy·-2 — 두목 표(이름·생김새·티어), 몬스터 표(티어 1~4·사람형/짐승) */
  const en = await ev(() => {
    var E = DG.enemyData, bs = E.bosses, es = E.enemies;
    return { boss: bs.length, bossOk: bs.every((b) => b.name && b.tier && (b.kind !== 'human' || b.look)), mon: es.length, tiers: Array.from(new Set(es.map((e) => e.tier))).sort(), kinds: Array.from(new Set(es.map((e) => e.kind))), monOk: es.every((e) => e.name && e.emoji && e.tier >= 1 && e.tier <= 4 && (e.kind !== 'human' || e.look)), humanLook: es.filter((e) => e.kind === 'human').every((e) => e.look) };
  });
  check('dg.data-enemy 두목 — 두목 표(지금 ' + en.boss + ') 모두 이름·티어, 사람형은 생김새(짐승·용은 몸 모양이 따로)', en.boss >= 10 && en.bossOk, JSON.stringify({ boss: en.boss, ok: en.bossOk }));
  check('dg.data-enemy-2 몬스터 — 몬스터 표(지금 ' + en.mon + ') 티어 1~4 가 다 있고 사람형·짐승이 함께, 모두 이름·이모지·티어, 사람형은 생김새', en.mon >= 130 && JSON.stringify(en.tiers) === '[1,2,3,4]' && en.kinds.indexOf('human') >= 0 && en.kinds.indexOf('beast') >= 0 && en.monOk, JSON.stringify(en));

  /* dg.quest — 메인 첫 줄은 「제3층까지」, 3층에 닿으면 다음 메인 · 지역 퀘스트는 테마 수만큼·처음 잠김 · 현상판 다시 뽑기 · 사연 사슬 아홉 */
  const qs = await ev(() => {
    var Q = DG.quest, QD = DG.questData, s0 = Q.status(), m0 = s0.mainIdx, name0 = s0.main && s0.main.name;
    Q._onFloor(3); var s1 = Q.status();
    var rnd0 = JSON.stringify(s1.random || s1.board || null); Q.reroll(); var rnd1 = JSON.stringify(Q.status().random || Q.status().board || null);
    return { name0: name0, desc0: s0.main && s0.main.desc, m0: m0, m1: s1.mainIdx, regions: s0.regions.length, locked: s0.regions.every((x) => x.locked), themes: DG.dungeonData.THEMES.length, chains: Object.keys(QD.CHAINS).length, steps: QD.CHAIN_STEPS.length, main: QD.MAIN.length, rerolled: rnd0 !== rnd1, rnd: rnd1.slice(0, 80) };
  });
  check('dg.quest 퀘스트 — 메인 첫 줄 「제3층까지」는 3층에 닿으면 다음으로, 지역 퀘스트는 테마 수만큼·처음 잠김, 현상판은 다시 뽑히고, 사연 사슬 아홉',
    /3층/.test(qs.desc0 || '') && qs.m1 === qs.m0 + 1 && qs.regions === qs.themes && qs.locked && qs.chains === 9 && qs.rerolled, JSON.stringify(qs));

  /* dg.sfx — 단서 50+ · 때린 맛 자리 일곱(hit·crit·kill·boss·hurt·heavy·die)만 진동, 줍기 소리는 안 울림, 진동 끄면 안 울림 */
  const sx = await ev(() => {
    var S = DG.sfx, keys = ['hit', 'crit', 'kill', 'boss', 'hurt', 'heavy', 'die'], quiet = Object.keys(S.CUES).find((k) => keys.indexOf(k) < 0 && /coin|pick|gold|drop/.test(k)) || 'coin';
    S.setVibrateEnabled(true); window.__vib.length = 0;
    var hits = keys.map((k) => { var n = window.__vib.length; S.play(k); return window.__vib.length > n; });
    var n0 = window.__vib.length; S.play(quiet); var quietVib = window.__vib.length > n0;
    S.setVibrateEnabled(false); window.__vib.length = 0; S.play('kill'); var offVib = window.__vib.length; S.setVibrateEnabled(true);
    return { cues: Object.keys(S.CUES).length, sup: S.vibrateSupported(), hits: hits, quiet: quiet, quietVib: quietVib, offVib: offVib };
  });
  check('dg.sfx 소리·진동 — 단서 50 이상, 때린 맛 자리 일곱만 진동하고 줍기 소리는 안 울리며, 진동을 끄면 안 울린다',
    sx.cues >= 50 && sx.sup && sx.hits.every(Boolean) && !sx.quietVib && sx.offVib === 0, JSON.stringify(sx));

  /* dg.account — 세이브 키 yeoksa-dungeon/save/<프로필>, 둘째 프로필은 키가 다르고 금이 안 섞인다 */
  const ac0 = await ev(() => { var A = DG.account, cur = A.current(); DG.core.save.player.gold = 777; DG.core.persist(); return { id: cur.id, key: A.keyOf(cur.id), n: A.list().length, saved: !!localStorage.getItem(A.keyOf(cur.id)) }; });
  await ev(() => { DG.account.create('둘째'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  const ac1 = await ev((first) => { var A = DG.account, cur = A.current(), raw = JSON.parse(localStorage.getItem(A.keyOf(first)) || '{}'); return { id: cur.id, key: A.keyOf(cur.id), n: A.list().length, gold: DG.core.save.player.gold, firstGold: raw.player && raw.player.gold }; }, ac0.id);
  check('dg.account 계정 — 세이브 키는 yeoksa-dungeon/save/<프로필>, 둘째 프로필은 키가 다르고 목록이 둘, 첫 프로필의 금(777)이 섞이지 않는다',
    ac0.key === 'yeoksa-dungeon/save/' + ac0.id && ac0.saved && ac1.n === ac0.n + 1 && ac1.id !== ac0.id && ac1.key !== ac0.key && ac1.gold !== 777 && ac1.firstGold === 777, JSON.stringify({ ac0, ac1 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-close2.json', JSON.stringify({ script: 'pw-dg-close2.mjs', game: 'saga-dungeon', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
