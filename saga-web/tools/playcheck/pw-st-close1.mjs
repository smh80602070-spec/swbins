// 사가종횡 확인 닫기 ①(W-0091) — 장비·직업/무예·사명/업적·사냥터 사건(채집·보물상자)·보스·소리를 실제 판에서 한 번씩 해 본다.
//   node pw-st-close1.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-st-sheet 와 같다(새 계정 → title-continue → 이야기 장면 Esc → DG.side.enter). 레벨은 세이브 값을 바로 올린다(판 맞추기).
// 화면 단추(data-act — saga-story/js/ui.js 에서 찾음): 가방 시트 `g-equip` · 직업 시트 `j-join`·`j-raise` · 사명 `q-take`.
// 사냥터는 pw-st-sheet 처럼 키를 페이지 안에서 누르고 게임 시간은 DG.side.update(1/60) 로 센다(소프트웨어 렌더링 프레임 속도와 무관).
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-st-close1.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-story');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const skipScenes = async () => { for (let i = 0; i < 12 && await ev(() => !!(DG.story && DG.story.isOpen && DG.story.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
const sheet = async (name) => { await ev((n) => { DG.ui.openSheet(n); }, name); await sleep(500); };
const closeSheet = async () => { await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } }); await sleep(250); };
const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);
const sim = (n) => ev((k) => { for (var i = 0; i < k; i++) { DG.side.update(1 / 60); } return null; }, n);
const key = (type, k) => ev(([t, kk]) => { window.dispatchEvent(new KeyboardEvent(t, { key: kk })); }, [type, k]);

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(4000);
  await skipScenes();

  /* st.data-gear — 부위 10·각 4단, 주문서 100/60/10, 고유 10, 가방 24, 판값 3할 · 요구 레벨 못 채우면 거부 · 가방 「낀다」 단추로 끼면 힘이 오른다 · 방어 깎기는 6할까지 */
  const gr0 = await ev(() => {
    var GD = DG.gearData, G = DG.gear, per = {};
    GD.GEAR.forEach((g) => { per[g.slot] = (per[g.slot] || 0) + 1; });
    var rates = Array.from(new Set(GD.SCROLLS.map((s) => s.rate))).sort();
    var hi = GD.GEAR.find((g) => g.need > DG.core.save.player.level), hiIt = G.make(hi.key); G.put(hiIt);
    var lv = DG.core.save.player.level, arm = GD.GEAR.filter((g) => g.need <= lv && (g.def || 0) > 0)[0] || GD.GEAR.filter((g) => g.need <= lv)[0];
    var it = G.make(arm.key); G.put(it);
    return { slots: GD.SLOTS.length, per: per, rates: rates, uniq: DG.uniqueData ? (DG.uniqueData.UNIQUES || DG.uniqueData.LIST || []).length : null, bag: G.BAG, sell: G.SELL_RATE,
      hiOk: G.equip(hiIt.uid), uid: it.uid, key: arm.key, p0: DG.side.power(), cutMax: G.cut(1e6), cut40: G.cut(40) };
  });
  await sheet('bag');
  const eqBtn = await domClick('#sheet-body [data-act="g-equip"][data-uid="' + gr0.uid + '"]'); await sleep(400);
  const gr1 = await ev((u) => ({ worn: DG.gear.isEquipped(u), p1: DG.side.power() }), gr0.uid);
  await closeSheet();
  const pUp = (gr1.p1.atk + gr1.p1.def + gr1.p1.hp) > (gr0.p0.atk + gr0.p0.def + gr0.p0.hp);
  check('st.data-gear 장비 — 부위 10·각 4단, 주문서 100/60/10%, 가방 24, 판값 3할 · 요구 레벨 못 채운 장비는 거부, 가방 「낀다」 단추로 끼면 힘이 오른다 · 방어 깎기는 6할까지',
    gr0.slots === 10 && Object.keys(gr0.per).every((k) => gr0.per[k] === 4) && JSON.stringify(gr0.rates) === JSON.stringify([0.1, 0.6, 1]) && gr0.bag === 24 && gr0.sell === 0.3 && gr0.hiOk === false && eqBtn && gr1.worn && pUp && gr0.cutMax === 0.6 && gr0.cut40 === 0.5,
    JSON.stringify({ gr0: Object.assign({}, gr0, { p0: undefined }), eqBtn, worn: gr1.worn, pUp }));

  /* st.data-job — 직업 21·무예 104, 5차는 각성기 둘을 더한다 · 레벨이 모자라면 전직 거부, 직업 시트 「전직」 단추로 무장 · 앞 무예 없이는 뒷 무예 거부 · 되돌리면 쓴 점수 0 */
  const jb0 = await ev(() => { var JD = DG.jobData; return { jobs: JD.JOBS.length, skills: JD.SKILLS.length, awaken: JD.JOBS.filter((j) => j.tier === 5).map((j) => JD.SKILLS.filter((s) => s.job === j.key).length), lowWhy: DG.job.canJoin('warrior') }; });
  await ev(() => { DG.core.save.player.level = 12; DG.core.emit('changed'); });
  await sheet('job');
  const joinBtn = await domClick('#sheet-body [data-act="j-join"][data-job="warrior"]'); await sleep(400);
  const jb1 = await ev(() => {
    var J = DG.job, JD = DG.jobData, mine = JD.skillsOf('warrior'), root = mine.find((s) => !s.need && s.max > 0);
    return { cur: J.cur() && (J.cur().key || J.cur()), root: root && root.key, spLeft: J.spLeft() };
  });
  await sheet('job');
  const raiseBtn = await domClick('#sheet-body [data-act="j-raise"][data-skill="' + jb1.root + '"]'); await sleep(400);
  /* 선행 무예는 2차부터 있다 — 1차 무예를 다섯 올려 장군으로 전직한 뒤, 앞 무예를 안 올린 2차 무예는 거부되는지 본다 */
  const jb2 = await ev((k) => {
    var J = DG.job, JD = DG.jobData, lv1 = J.levelOf(k), n;
    DG.core.save.player.level = 26; for (n = 0; n < 4; n++) { J.raise(k); }
    var joined = J.join('general'), locked = JD.skillsOf('general').find((s) => s.job === 'general' && s.need && J.levelOf(s.need.key) < s.need.lv);
    var lockWhy = locked ? J.canRaise(locked.key) : null, lockRaise = locked ? J.raise(locked.key) : null, lockLv = locked ? J.levelOf(locked.key) : null;
    var sp1 = J.spSpent(), rs = J.resetJob();
    return { lv1: lv1, joined: joined, locked: locked && locked.key, lockWhy: lockWhy, lockRaise: lockRaise, lockLv: lockLv, sp1: sp1, reset: rs, sp2: J.spSpent(), cur2: DG.core.save.job };
  }, jb1.root);
  await closeSheet();
  check('st.data-job 직업·무예 — 직업 21·무예 104, 5차는 각성기 둘씩 · 레벨이 모자라면 전직 거부, 직업 시트 「전직」 단추로 무장이 되고, 앞 무예 없이는 뒷 무예 거부, 「올린다」 단추로 올린 뒤 되돌리면 쓴 점수 0',
    jb0.jobs === 21 && jb0.skills === 104 && jb0.awaken.length === 4 && jb0.awaken.every((n) => n === 2) && typeof jb0.lowWhy === 'string' && joinBtn && jb1.cur === 'warrior' && raiseBtn && jb2.lv1 === 1 && jb2.joined && !!jb2.locked && typeof jb2.lockWhy === 'string' && jb2.lockRaise === false && jb2.lockLv === 0 && jb2.sp1 >= 5 && jb2.reset && jb2.sp2 === 0,
    JSON.stringify({ jb0, joinBtn, jb1, raiseBtn, jb2 }));

  /* st.data-quest — 사명 20(일일 2)·업적 9 · 사명 「받는다」 단추 전엔 0, 받은 뒤 그 사냥터 적을 잡으면 늘고 다른 사냥터 적은 안 센다 · 업적 · 경험치 곡선은 25 넘어 완만 */
  const qd0 = await ev(() => { var QD = DG.questData, AD = DG.achieveData; return { n: QD.QUESTS.length, daily: QD.QUESTS.filter((q) => q.daily).length, ach: AD ? AD.ACHIEVES.length : DG.achieve.list().length, p0: DG.quest.progress('q_field') }; });
  let qBtn = false;
  for (const nm of ['story', 'field', 'achieve', 'bag']) { if (qBtn) { break; } await sheet(nm); qBtn = await domClick('#sheet-body [data-act="q-take"][data-q="q_field"]'); await sleep(300); }
  await closeSheet();
  const qd1 = await ev(() => {
    var Q = DG.quest, a = Q.progress('q_field'); Q._onKill({ stage: 'field' }); var b = Q.progress('q_field'); Q._onKill({ stage: 'cave' }); var c = Q.progress('q_field');
    var before = DG.achieve.list().filter((x) => x.done).length; DG.achieve._check(); var after = DG.achieve.list().filter((x) => x.done).length, lv10 = DG.achieve.done('a_lv10');
    var E = DG.core.expNeed;
    return { taken: Q.taken('q_field'), a: a, b: b, c: c, ach: [before, after], lv10: lv10, r25: E(25) / E(24), r26: E(26) / E(25) };
  });
  check('st.data-quest 사명·업적 — 사명 20 이상(지금 33, 일일 2)·업적 9 · 「받는다」 단추 전엔 0, 받은 뒤 허창 들판 적을 잡으면 1 늘고 다른 사냥터 적은 안 센다 · 레벨 10 업적이 선다 · 경험치 곡선은 25 넘어 완만',
    qd0.n >= 20 && qd0.daily === 2 && qd0.ach === 9 && qd0.p0 === 0 && qBtn && qd1.taken && qd1.b === qd1.a + 1 && qd1.c === qd1.b && qd1.lv10 && qd1.r26 < qd1.r25,
    JSON.stringify({ qd0, qBtn, qd1 }));

  /* 사냥터로 */
  const entered = await ev(() => DG.side.enter('field'));
  await sleep(1500); await skipScenes();
  await ev(() => { var R = DG.side.raw(); R.hp = R.hpMax = 99999; R.player.invuln = 99; });

  /* st.side-3 — 채집물 위를 실제 → 키로 지나가면 가방에 들고 그 자리가 비었다가 때가 되면 다시 돋는다 · 채집 보너스 터 안에선 더 · 보물상자를 밟으면 열려 금 */
  const sd0 = await ev(() => {
    var R = DG.side.raw(), p = R.player, g = R.gathers.find((x) => x.alive), s = DG.side.state();
    if (!g) { return { none: true }; }
    if (R.forage) { R.forage.x1 = -1; R.forage.x2 = -1; }   // 첫 줍기는 보너스 터 밖에서
    p.x = g.x - 70; p.y = R.stage.floor - 54; p.vx = 0; p.vy = 0;
    return { kind: g.kind, gx: g.x, m0: (s.mats[g.kind] || 0), forage: !!R.forage };
  });
  await key('keydown', 'ArrowRight'); await sim(60); await key('keyup', 'ArrowRight'); await sim(10);
  const sd1 = await ev((a) => {
    var R = DG.side.raw(), s = DG.side.state(), g = R.gathers.find((x) => x.x === a.gx);
    var out = { m1: s.mats[a.kind] || 0, alive: g.alive, wait: g.respawnAt - Date.now() };
    g.respawnAt = Date.now() - 1; DG.side.update(1 / 60); out.back = g.alive;
    /* 보너스 터 — 그 채집물을 터 안에 두고 다시 줍는다 */
    R.forage = R.forage || { x1: 0, x2: 0 }; R.forage.x1 = g.x - 200; R.forage.x2 = g.x + 200; R.forage.notified = false;
    var p = R.player; p.x = g.x - 70; p.vx = 0; return out;
  }, sd0);
  await key('keydown', 'ArrowRight'); await sim(60); await key('keyup', 'ArrowRight'); await sim(10);
  const sd2 = await ev((a) => {
    var R = DG.side.raw(), s = DG.side.state(), m2 = s.mats[a.kind] || 0;
    if (!R.chest) { R.chest = { x: R.player.x + 120, opened: false }; }
    var g0 = R.gold; R.player.x = R.chest.x - 60; R.player.vx = 0;
    return { m2: m2, chestX: R.chest.x, g0: g0 };
  }, sd0);
  await key('keydown', 'ArrowRight'); await sim(40); await key('keyup', 'ArrowRight'); await sim(10);
  const sd3 = await ev(() => { var R = DG.side.raw(); return { opened: !!(R.chest && R.chest.opened), gold: R.gold }; });
  const gain1 = sd1.m1 - sd0.m0, gain2 = sd2.m2 - sd1.m1;
  check('st.side-3 사냥터 사건 — 채집물 위를 → 키로 지나가면 가방에 들고 그 자리가 비었다 때가 되면 다시 돋는다, 채집 보너스 터 안에선 더 많이, 보물상자를 밟으면 열려 금',
    !sd0.none && gain1 === 1 && !sd1.alive && sd1.wait > 0 && sd1.back && gain2 > gain1 && sd3.opened && sd3.gold > sd2.g0, JSON.stringify({ sd0, sd1, gain1, gain2, sd3, entered }));

  /* st.sfx — 적을 칠 때 hit·hit2·hit3 가 돌아가며 요청되고, 효과음을 꺼도 요청은 남으며, 잡으면 kill */
  const sx = await ev(() => {
    var R = DG.side.raw(), p = R.player, S = DG.sfx, e = R.enemies.filter((x) => x.hp > 0).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (!e) { e = DG.side.spawnEnemy(p.x + 40); }
    e.hp = e.hpMax = 1e9; p.x = e.x - 40; p.y = e.y; p.facing = 1; p.vx = 0;
    S._clear(); var seen = [], i;
    for (i = 0; i < 40 && seen.filter((k) => /^hit/.test(k)).length < 6; i++) { p.cds = p.cds.map(() => 0); R.mp = 9999; DG.side.castSkill(0); DG.side.update(1 / 60); seen = S._tail(40); }
    var hits = seen.filter((k) => /^hit/.test(k));
    S.setEnabled(false); S._clear(); p.cds = p.cds.map(() => 0); R.mp = 9999; DG.side.castSkill(0); DG.side.update(1 / 60); var off = S._tail(10).slice(); S.setEnabled(true);
    e.hp = 1; S._clear(); p.cds = p.cds.map(() => 0); R.mp = 9999; DG.side.castSkill(0); for (i = 0; i < 3; i++) { DG.side.update(1 / 60); } var killT = S._tail(40).filter((k) => k !== 'land');   // 공중에 둔 몸이 매 틀 land 를 내 꼬리를 덮는다
    return { hits: hits.slice(0, 6), off: off, kill: killT, groups: Object.keys(S.CUES).length };
  });
  const rot = new Set(sx.hits).size === 3 || (sx.hits.indexOf('hit') >= 0 && sx.hits.indexOf('hit2') >= 0 && sx.hits.indexOf('hit3') >= 0);
  check('st.sfx 소리 — 적을 치면 hit·hit2·hit3 가 돌아가며 요청되고, 효과음을 꺼도 요청은 남으며, 잡으면 kill 소리',
    rot && sx.off.some((k) => /^hit|crit/.test(k)) && sx.kill.some((k) => k === 'kill' || k === 'bosskill'), JSON.stringify(sx));

  /* st.data-side-2 — 보스는 네 사냥터에만, 12~17배·다시 나오기 15~30분, 사냥터 오른쪽 끝에 서고 · 체력 66%·33% 에서 패턴 단계가 오르고 · 잡은 뒤엔 쿨 동안 다시 안 나온다 */
  const bs0 = await ev(() => {
    var SD = DG.sideData, list = SD.STAGES.filter((s) => s.boss);
    return { n: list.length, keys: list.map((s) => s.key), mul: list.map((s) => s.boss.hpMul), cool: list.map((s) => s.boss.cool), need: list.map((s) => s.need) };
  });
  const bstage = bs0.keys[0];
  const bs1 = await ev((k) => {
    DG.core.save.player.level = 90; var s = DG.side.state(); s.bossAt = s.bossAt || {}; s.bossAt[k] = 0;
    var ok = DG.side.travel(k) || DG.side.enter(k), R = DG.side.raw(), b = R.boss, BP = DG.bossPattern;
    var out = { ok: ok, stage: R.stage.key, width: R.stage.width, bx: b ? b.x : null, ready: DG.side.bossReady(k) };
    if (BP) { out.ph = [BP.phaseOf(100, 100), BP.phaseOf(60, 100), BP.phaseOf(30, 100)]; out.pool = [0, 1, 2].map((p) => BP.poolOf(p).length); }
    if (b) { b.hp = 1; b.invuln = 0; var p = R.player; p.x = b.x - 40; p.y = b.y; p.facing = 1; p.invuln = 99; R.hp = R.hpMax = 99999; var i; for (i = 0; i < 60 && R.boss && R.boss.hp > 0; i++) { p.cds = p.cds.map(() => 0); R.mp = 9999; DG.side.castSkill(0); DG.side.update(1 / 60); } }
    for (var j = 0; j < 30; j++) { DG.side.update(1 / 60); }
    out.dead = !DG.side.raw().boss || DG.side.raw().boss.hp <= 0; out.readyAfter = DG.side.bossReady(k); out.left = DG.side.bossLeft(k);
    return out;
  }, bstage);
  check('st.data-side-2 보스 — 보스 사냥터 넷 이상(지금 9), 체력 12배 이상·다시 나오기 15분 이상, 사냥터 오른쪽 끝(너비−220)에 서고, 66%·33% 에서 패턴 단계가 올라 수가 늘며, 잡은 뒤엔 쿨 동안 다시 안 나온다',
    bs0.n >= 4 && bs0.mul.every((m) => m >= 12) && bs0.cool.every((c) => c >= 15) && bs1.stage === bstage && bs1.bx === bs1.width - 220 && JSON.stringify(bs1.ph) === '[0,1,2]' && bs1.pool[1] > bs1.pool[0] && bs1.dead && !bs1.readyAfter && bs1.left > 0,
    JSON.stringify({ bs0, bs1 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-st-close1.json', JSON.stringify({ script: 'pw-st-close1.mjs', game: 'saga-story', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
