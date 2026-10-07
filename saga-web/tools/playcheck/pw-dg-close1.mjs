// 사가나락 확인 닫기 ①(W-0089) — 장비·세공/주옥·단약/행상·투장·무예 트리·원소 저항·던전 층·설정을 실제 판에서 한 번씩 해 본다.
//   node pw-dg-close1.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-dg-sheet 와 같다(새 계정 → 어드민 프리셋 「⚔️ 명품 한 벌 갖춘 판」 → 다시 들어감, 마을에서 시작).
// 화면 단추(data-act — saga-dungeon/js/ui.js 에서 찾음): 장비 시트 `gear-sel`·`gear-equip` · 행상 `vendor-potion` · 무예 `skill-hero`·`skill-learn`
//   · 설정 `snd-toggle`·`vib-toggle` · 던전 안 투장 무예는 실제 F 키. 장비 굴리기·세공·피해 넣기는 화면이 부르는 같은 함수로 친다.
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-dg-close1.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-dungeon');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });

async function skipScenes() { for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } }
async function boot(fresh) {
  await page.goto(r.url('index.html')); await sleep(1500);
  if (fresh) { await ev(() => { DG.account.create('확인'); }); }
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await skipScenes();
}
async function preset(title) {
  await page.goto(r.url('_admin.html')); await sleep(2000);
  await page.locator('[data-tab="preset"]').click(); await sleep(300);
  const btn = page.locator('#presets .preset', { hasText: title });
  if (await btn.count() !== 1) { throw new Error('프리셋 없음 ' + title); }
  await btn.click(); await sleep(600);
  await boot(false);
}
const sheet = async (name) => { await ev((n) => { DG.ui.openSheet(n); }, name); await sleep(500); };
const closeSheet = async () => { await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } }); await sleep(250); };
const sum = (o) => Object.keys(o).reduce((s, k) => s + (typeof o[k] === 'number' ? o[k] : 0), 0);

/* 장비 하나를 굴려 감정해 가방에 넣는다 — opts 는 item.roll 그대로, need(it) 가 참일 때까지 다시 굴린다 */
const ROLL = () => { window.__roll = function (opts, need) { var I = DG.item, it = null, k; for (k = 0; k < 300; k++) { it = I.roll(opts.ilvl || 1, opts); delete it.unid; if (!need || need(it)) { break; } } I.add(it); return it; }; };

try {
  await boot(true);
  await preset('⚔️ 명품 한 벌 갖춘 판');
  await ev(ROLL);
  const base = await ev(() => ({ party: DG.core.save.party.slice(), town: !!(DG.town && DG.town.active && DG.town.active()) }));

  /* dg.ui-2 — ⚙️ 설정 시트의 효과음·진동 단추를 실제로 누르면 켜짐/꺼짐이 뒤집힌다 */
  await sheet('settings');
  const u0 = await ev(() => ({ snd: DG.sfx.enabled(), vib: DG.sfx.vibrateEnabled(), vsup: DG.sfx.vibrateSupported() }));
  await page.locator('#sheet-body [data-act="snd-toggle"]').first().click(); await sleep(300);
  const vibBtn = page.locator('#sheet-body [data-act="vib-toggle"]').first();
  const vibShown = await vibBtn.count() && await vibBtn.isVisible() && await vibBtn.isEnabled();
  if (vibShown) { await vibBtn.click(); await sleep(300); }
  const u1 = await ev(() => ({ snd: DG.sfx.enabled(), vib: DG.sfx.vibrateEnabled() }));
  await page.locator('#sheet-body [data-act="snd-toggle"]').first().click(); await sleep(200);   // 되돌린다
  if (vibShown) { await page.locator('#sheet-body [data-act="vib-toggle"]').first().click(); await sleep(200); }
  check('dg.ui-2 설정 — 효과음 단추를 누르면 켜짐이 뒤집히고, 진동은 되는 기기면 단추가 서서 뒤집힌다(안 되면 숨거나 막힘)',
    u1.snd === !u0.snd && (u0.vsup ? (vibShown && u1.vib === !u0.vib) : !vibShown), JSON.stringify({ u0, u1, vibShown }));
  await closeSheet();

  /* dg.data-item — 장비를 굴려 가방에 담고 장비 시트에서 골라 「~에게」 장착 단추 → 그 인물 능력이 오른다 · 구멍은 부위 상한 이하 · 주옥은 박으면 못 뺀다 */
  const it0 = await ev(() => {
    var I = DG.item, lead = DG.core.save.party[0], lv = DG.hero.info(lead).lv;
    var it = __roll({ ilvl: lv, tier: 4, slot: 'ring' }, (x) => !!I.bestOwner(x) && I.meetsReq(lead, x));
    var own = I.bestOwner(it);
    return { uid: it.uid, owner: own && own.id, s0: own ? DG.hero.stats(own.id) : null };
  });
  await sheet('gear');
  /* 장비 시트는 바뀔 때마다 다시 그려져 Playwright 클릭이 칸을 못 잡는다 — 그 칸에 DOM click 을 보낸다(같은 onAct 처리) */
  const domClick = (sel) => ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, sel);
  await domClick('#sheet-body [data-act="gear-sel"][data-id="' + it0.uid + '"]'); await sleep(400);
  const eqHas = await domClick('#sheet-body [data-act="gear-equip"][data-id="' + it0.uid + '"]'); await sleep(500);
  const it1 = await ev((a) => {
    var I = DG.item, eq = I.equipped(a.owner), worn = Object.keys(eq).some((k) => eq[k] && eq[k].uid === a.uid);
    var lim = I.SOCK_MAX, over = [];
    for (var k = 0; k < 60; k++) { var x = I.roll(30, { tier: 4 }); var sl = I.baseOf(x).slot; if (I.socketsOf(x).length > (lim[sl] || 0)) { over.push(sl + ':' + I.socketsOf(x).length); } }
    var arm = __roll({ ilvl: 30, tier: 4, slot: 'armor' }, (x) => I.socketsOf(x).length >= 1);
    var aj = I.addJewel(DG.gemData.rollJewel(30)), jid = aj.jewel && aj.jewel.id;   // id 는 주머니에 넣을 때 붙는다
    var e0 = I.emptySockets(arm), sres = I.socket(arm.uid, 'jewel', jid), e1 = I.emptySockets(arm), left = !!I.jewelById(jid);
    var undo = Object.keys(I).filter((n) => /unsocket|unSocket|removeSocket|pluck/i.test(n));
    return { worn: worn, s1: DG.hero.stats(a.owner), over: over, e0: e0, sok: sres && sres.ok, e1: e1, left: left, undo: undo };
  }, it0);
  check('dg.data-item 장비·세공 — 장비 시트 「~에게」 단추로 입으면 그 인물 능력이 오른다 · 구멍 수는 부위 상한 이하 · 주옥을 박으면 빈 구멍이 줄고 빼는 길이 없다',
    !!it0.owner && eqHas && it1.worn && sum(it1.s1) > sum(it0.s0) && it1.over.length === 0 && it1.sok && it1.e1 === it1.e0 - 1 && !it1.left && it1.undo.length === 0,
    JSON.stringify({ owner: it0.owner, eqHas, worn: it1.worn, s: [sum(it0.s0), sum(it1.s1)], over: it1.over, sock: [it1.e0, it1.e1], sok: it1.sok, left: it1.left, undo: it1.undo }));
  await closeSheet();

  /* dg.vendor — 행상 시트 단약 단추를 실제로 누르면 금이 들고 요대에 든다 · 요대가 차면 또 눌러도 금이 그대로 · 재고 등급은 STOCK_TIER_MAX 이하 */
  await ev(() => { DG.core.save.player.gold = 50000; });
  await sheet('vendor');
  const potBtn = page.locator('#sheet-body [data-act="vendor-potion"]').first();
  const pk = await potBtn.count() ? await potBtn.evaluate((b) => ({ kind: b.getAttribute('data-kind'), g: +b.getAttribute('data-g') })) : null;
  const v0 = await ev(() => ({ gold: DG.core.save.player.gold, total: DG.potion.total() }));
  if (pk) { await potBtn.click(); await sleep(400); }
  const v1 = await ev(() => ({ gold: DG.core.save.player.gold, total: DG.potion.total() }));
  const vfull = await ev((p) => { var P = DG.potion, k = 0; while (k++ < 200 && P.add(p.kind, p.g).ok) { /* 요대를 채운다 */ } DG.core.emit('changed'); return { total: P.total(), gold: DG.core.save.player.gold }; }, pk || { kind: 'hp', g: 0 });
  await sheet('vendor');
  if (pk) { await page.locator('#sheet-body [data-act="vendor-potion"]').first().click(); await sleep(400); }
  const v2 = await ev(() => ({ gold: DG.core.save.player.gold, total: DG.potion.total(), tiers: DG.vendor.stock().map((x) => DG.item.tierOf(x).key), max: DG.vendor.STOCK_TIER_MAX }));
  check('dg.vendor 행상·단약 — 단약 단추로 사면 금이 들고 요대가 하나 늘며, 요대가 차면 또 눌러도 금이 그대로 · 재고는 등급 상한(' + v2.max + ') 이하',
    !!pk && v1.gold < v0.gold && v1.total === v0.total + 1 && v2.gold === vfull.gold && v2.total === vfull.total && v2.tiers.length > 0 && v2.tiers.every((t) => t <= v2.max), JSON.stringify({ pk, v0, v1, vfull, v2 }));
  await closeSheet();

  /* dg.data-skill — 다섯 직업 무예 24씩 · 무기를 바꿔 입으면 직업이 바뀐다 · 앞 무예 없이 뒤 무예 단추를 누르면 안 배운다 */
  const sk0 = await ev(() => {
    var SD = DG.skillData, I = DG.item, lead = DG.core.save.party[0], c0 = DG.skill.classOf(lead).key;
    var per = SD.CLASSES.map((c) => c.key + ':' + SD.skillsOf(c.key).length);
    var lv = DG.hero.info(lead).lv, want = Object.keys(SD.WEAPON_CLASS).find((look) => SD.WEAPON_CLASS[look] !== c0);
    var w = __roll({ ilvl: lv, tier: 1, slot: 'weapon' }, (x) => { var b = I.baseOf(x); return b.look && SD.WEAPON_CLASS[b.look] && SD.WEAPON_CLASS[b.look] !== c0 && I.meetsReq(lead, x); });
    var ok = I.equip(lead, w.uid), c1 = DG.skill.classOf(lead).key;
    var later = SD.skillsOf(c1).find((s) => { var p = SD.prereqOf(s); return p && DG.skill.rankOf(lead, p.key) < 1; });
    return { lead: lead, per: per, c0: c0, c1: c1, eq: ok, want: want, later: later && later.key, rank0: later ? DG.skill.rankOf(lead, later.key) : null, left: DG.skill.pointsLeft(lead) };
  });
  await sheet('skill');
  const hb = page.locator('#sheet-body [data-act="skill-hero"][data-hero="' + sk0.lead + '"]').first();
  if (await hb.count()) { await hb.click(); await sleep(400); }
  /* 앞 무예가 없으면 화면은 「배운다」 대신 「🔒 ~을(를) 먼저」 를 낸다 — 단추가 없음을 보고, 앞 무예를 배운 뒤엔 단추가 서서 눌러 배운다 */
  const lk = await ev((a) => { var pre = DG.skillData.prereqOf(DG.skillData.skillByKey(a.later)); return { btn: !!document.querySelector('#sheet-body [data-act="skill-learn"][data-key="' + a.later + '"]'), lock: document.getElementById('sheet-body').textContent.indexOf('🔒 ' + pre.name) >= 0, pre: pre.key }; }, sk0);
  await ev((a) => { DG.skill.learn(a.lead, a.pre); DG.core.emit('changed'); }, Object.assign({}, sk0, { pre: lk.pre }));
  await sheet('skill');
  const hb2 = page.locator('#sheet-body [data-act="skill-hero"][data-hero="' + sk0.lead + '"]').first();
  if (await hb2.count()) { await hb2.click(); await sleep(400); }
  const lbHas = await ev((q) => { var b = document.querySelector(q); if (!b) { return false; } b.click(); return true; }, '#sheet-body [data-act="skill-learn"][data-key="' + sk0.later + '"]');
  await sleep(400);
  const sk1 = await ev((a) => ({ rank: DG.skill.rankOf(a.lead, a.later) }), sk0);
  check('dg.data-skill 무예 — 다섯 직업 모두 24 · 다른 직업 무기를 입으면 직업이 바뀐다 · 앞 무예가 없으면 뒤 무예는 🔒(단추 없음), 앞 무예를 배우면 「배운다」 단추로 배운다',
    sk0.per.length === 5 && sk0.per.every((x) => /:24$/.test(x)) && sk0.eq && sk0.c1 !== sk0.c0 && !!sk0.later && !lk.btn && lk.lock && lbHas && sk1.rank === 1, JSON.stringify({ sk0, lk, lbHas, sk1 }));
  await closeSheet();

  /* dg.data-set — 투장 2점 보너스 < 3점 보너스, 세 점을 선두가 다 걸치면 던전에서 F 로 투장 무예(쿨다운이 돌고 MP 는 안 쓴다) */
  const st0 = await ev(() => {
    var S = DG.setData, I = DG.item, lead = DG.core.save.party[0], set = S.SETS.find((x) => x.skill) || S.SETS[0];
    var eqd = set.pieces.map((pc) => { var it = __roll({ ilvl: 1, base: pc, tier: S.SET_TIER, set: set.key }, (x) => I.meetsReq(lead, x)); return I.equip(lead, it.uid); });
    return { eqd: eqd, set: set.key, b2: S.bonusFor(set, 2).length, b3: S.bonusFor(set, 3).length, worn: I.setCounts(lead)[set.key] || 0, sk: !!I.setSkillFor(lead) };
  });
  const entered = await ev(() => { if (DG.town) { DG.town.leave(); } return DG.dungeon.enter({ floor: 1 }); });
  await sleep(1500); await skipScenes();
  await ev(() => { var R = DG.dungeon.raw(); if (R) { R.hp = R.hpMax; R.player.setSkCd = 0; } });
  const mp0 = await ev(() => DG.dungeon.raw() ? DG.dungeon.raw().mp : null);
  await page.keyboard.press('f'); await sleep(300);
  const st1 = await ev(() => { var s = DG.dungeon.status(), R = DG.dungeon.raw(); return { avail: s.setSkill.avail, cd: s.setSkill.cd, mp: R ? R.mp : null, active: DG.dungeon.active() }; });
  check('dg.data-set 투장 — 2점 보너스보다 3점이 많고, 세 점을 선두가 걸치면 던전에서 F 키로 투장 무예가 나가 쿨다운이 돈다(MP 는 그대로)',
    st0.b3 > st0.b2 && st0.worn === 3 && st0.sk && st1.active && st1.avail && st1.cd > 0 && st1.mp !== null && st1.mp >= mp0 - 0.01, JSON.stringify({ st0, entered, mp0, st1 }));

  /* dg.dungeon-3 — 원소 일곱 · 갑주에 빙 보석을 박으면 냉기 저항이 오르고, 냉기로 맞으면 물리보다 그만큼 덜 아프다 */
  const el = await ev(() => {
    var I = DG.item, E = DG.elemData, lead = DG.core.save.party[0], D = DG.dungeon, R = D.raw();
    var gem = DG.gemData.GEMS.find((g) => g.el === 'cold' || g.elem === 'cold');
    var arm = __roll({ ilvl: 1, slot: 'armor' }, (x) => I.socketsOf(x).length >= 2 && I.meetsReq(lead, x)); var aeq = I.equip(lead, arm.uid);
    var r0 = (I.elemResist(lead).cold || 0);
    I.addMat('gem', gem.key, 4, 2); var a = I.socket(arm.uid, 'gem', gem.key, 4); var b = I.socket(arm.uid, 'gem', gem.key, 4);
    var r1 = (I.elemResist(lead).cold || 0), res = D.elemResOf('cold');
    var hit = (kind) => { R.hp = R.hpMax; R.player.invuln = 0; var h = R.hp; D._hurt(200, kind); return h - R.hp; };
    var phys = hit('phys'), cold = hit('cold');
    R.hp = R.hpMax; R.player.invuln = 99;
    return { aeq: aeq, n: E.ELEMENTS.length, key: !!E.elemByKey('cold'), gem: gem.key, sock: [a.ok, b.ok], r0: r0, r1: r1, res: res, phys: Math.round(phys), cold: Math.round(cold), want: Math.round(phys * (1 - res / 100)) };
  });
  check('dg.dungeon-3 원소 — 원소 일곱, 갑주에 빙 보석을 박으면 냉기 저항이 오르고, 냉기로 맞은 값은 물리 × (1 − 저항%)',
    el.n === 7 && el.key && el.sock[0] && el.r1 > el.r0 && el.res > 0 && Math.abs(el.cold - el.want) <= 1 && el.cold < el.phys, JSON.stringify(el));

  /* dg.data-dungeon — 층 테마가 1·6·11·16·21·26 에서 여섯으로 바뀌고, 5층은 두목 층, 층마다 방 배치가 있다 */
  const dd = await ev(() => { var DD = DG.dungeonData, fl = [1, 6, 11, 16, 21, 26], th = fl.map((f) => { var t = DD.themeOf(f); return t && (t.key || t.name); }); return { th: th, distinct: new Set(th).size, boss3: DD.isBossFloor(3), boss6: DD.isBossFloor(6), boss5: DD.isBossFloor(5), rooms: fl.map((f) => DD.roomsFor(f)) }; });
  check('dg.data-dungeon 층 — 테마 여섯이 1·6·11·16·21·26 층에서 바뀌고, 두목 층은 3의 배수(3·6 참, 5 거짓), 층마다 방이 넷 이상',
    dd.distinct === 6 && dd.boss3 === true && dd.boss6 === true && dd.boss5 === false && dd.rooms.every((n) => n >= 4), JSON.stringify(dd));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-close1.json', JSON.stringify({ script: 'pw-dg-close1.mjs', game: 'saga-dungeon', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
