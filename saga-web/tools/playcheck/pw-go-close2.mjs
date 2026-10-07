// 사가고 확인 닫기 ②(W-0094) — 지도·지형·손그림 땅·등용/포획·주민·권역·스프라이트를 실제 판에서 한 번씩 해 본다.
//   node pw-go-close2.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면 단추: 시점 #btn-tilt · 등용 카드 `[data-appeal]` · 포획 카드 `[data-act="throw"]` · 말 걸기는 talk.pick→tap(지도를 누른 것과 같은 길).
// OSM 그물 요청에는 기대지 않는다(오프라인에서도 같은 결과). Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-go-close2.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-go');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const encOn = () => ev(() => document.getElementById('encounter').classList.contains('show'));
async function closeEnc() { for (let i = 0; i < 4 && await encOn(); i++) { await ev(() => { var b = document.querySelector('#encounter [data-act="ok"], #encounter [data-act="flee"], #encounter [data-act="close"]'); if (b) { b.click(); } else if (DG.encounter.close) { DG.encounter.close(); } }); await sleep(300); } }

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { DG.core.setTune('world3d.dayNight', 0); });

  /* go.world — 구역 이름 30·같은 칸 같은 이름 · 시점 단추가 셋을 돌아 처음으로 · 곁에 스폰 */
  const w0 = await ev(() => { var W = DG.world, names = {}, x, y; for (x = -20; x < 20; x++) { for (y = -20; y < 20; y++) { names[W.regionName(x + ',' + y)] = 1; } } var n = W.nearest(); return { names: Object.keys(names).length, same: W.regionName('3,-4') === W.regionName('3,-4'), near: !!(n && n.spawn), tilt: document.getElementById('btn-tilt').textContent.trim() }; });
  const tilts = [w0.tilt];
  for (let i = 0; i < 3; i++) { await page.locator('#btn-more').click().catch(() => {}); await sleep(200); await page.locator('#btn-tilt').click({ force: true }); await sleep(900); tilts.push(await ev(() => document.getElementById('btn-tilt').textContent.trim())); }
  await ev(() => { var m = document.getElementById('top-more'); if (m) { m.classList.remove('show'); } });
  const modes = new Set(tilts.slice(0, 3).map((t) => t.replace(/\s.*$/, '')));
  check('go.world 지도 — 구역 이름 30·같은 칸은 늘 같은 이름, 시점 단추를 누르면 2D·2.5D·3D 셋을 돌아 처음으로, 곁에 스폰이 있다',
    w0.names === 30 && w0.same && w0.near && modes.size === 3 && tilts[3].replace(/\s.*$/, '') === tilts[0].replace(/\s.*$/, ''), JSON.stringify({ w0, tilts }));

  /* go.geo — OSM 태그 → 땅 갈래, 층 순서 6, 칸 열쇠가 늘 같다, 원점 땅이 갈래를 낸다(그물 없이 land→geo→해시) */
  const g = await ev(() => { var G = DG.geo, k = G.kindOfTags, rk = G.regionKeyOf; return { order: G.LAYER_ORDER, water: k({ natural: 'water' }), forest: k({ landuse: 'forest' }), road: k({ highway: 'primary' }), key: rk ? [String(rk(37.5, 127)), String(rk(37.5, 127))] : null, t0: DG.world.terrainAt(0, 0), t1: DG.world.terrainAt(40, -30) }; });
  check('go.geo 실제 지형 — OSM 태그가 물·숲·길로 갈리고, 층 순서 6, 칸 열쇠가 늘 같고, 그물 없이도 원점 땅 갈래가 나온다',
    g.order.length === 6 && g.water === 'water' && g.forest === 'forest' && g.road === 'road' && (!g.key || g.key[0] === g.key[1]) && !!g.t0 && !!g.t1, JSON.stringify(g));

  /* go.land — 하북 손그림 땅 검사 0건, 갈래 세기, 손으로 놓은 소품이 그 칸에서 나온다 */
  /* 하북 땅엔 손으로 놓은 소품이 아직 0개(맵 편집기가 놓을 자리만 있다) — 편집기가 넣는 꼴 그대로 한 점 놓아 그 칸에서 나오는지 보고 치운다 */
  const ld = await ev(() => {
    var L = DG.land, R = L.region(), bad = L.validate(), t = L.tally(), deco0 = R && R.deco ? R.deco.length : 0;
    if (!R.deco) { R.deco = []; }
    var tx = R.ox + 3, ty = R.oy + 3, d = { t: 'well', x: tx * 48 + 20, z: ty * 48 + 28, h: 1 };
    R.deco.push(d); var at = L.decoAt(tx, ty), off = L.decoAt(tx + 1, ty).length; R.deco.pop();
    return { has: !!R, bad: bad.slice(0, 3), kinds: Object.keys(t).length, deco0: deco0, at: at.length, atT: at[0] && at[0].t, off: off, after: L.decoAt(tx, ty).length, info: L.info().on };
  });
  check('go.land 손그림 땅 — 하북 땅 검사 0건, 땅 갈래를 세고, 손으로 놓은 소품은 그 칸에서만 나온다(하북엔 아직 0개 — 한 점 놓아 봄)',
    ld.has && ld.bad.length === 0 && ld.kinds >= 3 && ld.at === 1 && ld.atT === 'well' && ld.off === 0 && ld.after === 0 && ld.info, JSON.stringify(ld));

  /* go.encounter — 인물: 성향에 맞는 설득 단추 세 번 → 등용·금 · 펫: 바늘이 과녁 안일 때 「던진다」 → 사료가 줄고 결과 */
  const e0 = await ev(() => { var h = DG.data.heroes.find((x) => !DG.core.save.dex.heroes[x.id] && x.rarity <= 2) || DG.data.heroes[0]; DG.core.save.items.scroll = Math.max(5, DG.core.save.items.scroll || 0); DG.core.save.player.fame = Math.max(DG.core.save.player.fame, 5000); var g0 = DG.core.save.player.gold; DG.encounter.open({ uid: 99001, kind: 'hero', ref: h, x: 0, y: 0 }); return { id: h.id, trait: h.trait, g0: g0 }; });
  /* ⑯ 싸워서 등용 — 등용서·명성이 있으면 카드 없이 곧장 들판 겨루기가 선다. 상대 곁으로 가 실제 J 로 쳐서 굴복시키면 등용 */
  await sleep(600);
  const duel = await ev(() => { var FC = DG.fieldCombat, S = FC.state(), d = S && S.duel; if (!d) { return null; } var f = S.foes[d.uid], p = DG.core.save.player.pos; S.party.forEach((m) => { m.hp = m.hpMax = 99999; }); f.hp = Math.min(f.hp, 1); if (f.shield) { f.shield = 0; } p.x = f.x - 2.5; p.y = f.y; return { uid: d.uid, hp: f.hp }; });
  let pressed = 0;
  for (let i = 0; i < 20 && duel && !(await ev((id) => !!DG.core.save.dex.heroes[id], e0.id)); i++) {
    await ev((u) => { var S = DG.fieldCombat.state(), f = S.foes[u], p = DG.core.save.player.pos; if (f) { p.x = f.x - 2.5; p.y = f.y; } }, duel.uid);
    await page.keyboard.press('j'); pressed++; await sleep(350);
  }
  const e1 = await ev((id) => ({ dex: !!DG.core.save.dex.heroes[id], gold: DG.core.save.player.gold, txt: document.getElementById('encounter').innerText.replace(/\s+/g, ' ').slice(0, 80) }), e0.id);
  await closeEnc();
  const p0 = await ev(() => { var p = DG.data.pets.find((x) => !DG.core.save.dex.pets[x.id]) || DG.data.pets[0]; DG.core.save.items.feed = Math.max(3, DG.core.save.items.feed || 0); var f0 = DG.core.save.items.feed; DG.encounter.open({ uid: 99002, kind: 'pet', ref: p, x: 0, y: 0 }); return { id: p.id, f0: f0 }; });
  /* 펫은 사료가 있으면 실시간 전투(rogue-action) 뒤 포획 판정 — 자동 전투 🤖(입력만 대신)를 켜 끝까지 싸우게 한다 */
  await sleep(800);
  await ev(() => { if (DG.rogueAction.setAuto) { DG.rogueAction.setAuto(true); } });
  let thrown = null;
  for (let i = 0; i < 60 && !thrown; i++) { await sleep(500); thrown = await ev((f0) => (DG.core.save.items.feed < f0 ? { at: Date.now() } : null), p0.f0); }
  await ev(() => { if (DG.rogueAction.setAuto) { DG.rogueAction.setAuto(false); } });
  await sleep(800);
  const p1 = await ev((id) => ({ feed: DG.core.save.items.feed, done: true, caught: !!DG.core.save.dex.pets[id], txt: document.getElementById('encounter').innerText.replace(/\s+/g, ' ').slice(0, 80) }), p0.id);
  await closeEnc();
  check('go.encounter 등용·포획 — 등용서·명성이 있으면 들판 겨루기가 서고 J 로 굴복시키면 등용되어 도감·금이 오르고, 펫은 실전(자동 전투)을 치르면 사료 하나를 쓰고 포획 판정이 난다',
    !!duel && pressed >= 1 && e1.dex && e1.gold > e0.g0 && !!thrown && p1.feed === p0.f0 - 1 && p1.done, JSON.stringify({ e0, duel, pressed, e1, thrown, p1 }));

  /* go.npc — 주민 10·짐승 15(5종) · 주민 곁에서 말 걸기 → 카드 */
  const nc = await ev(() => {
    var N = DG.npc, A = DG.animal, T = DG.talk, pos = DG.core.save.player.pos, live = N.live(pos), k;
    for (k = 0; k < N.list().length && !live.length; k++) { var at = N.posAt(N.list()[k], Date.now()); if (at) { pos.x = at.x + 4; pos.y = at.y; live = N.live(pos); } }
    if (live[0]) { pos.x = live[0].x + 1; pos.y = live[0].y; live = N.live(pos); }   // 말이 닿는 거리(NPC_R) 안으로 — 멀면 tap 이 걸어가기가 된다
    var it = live[0], hit = it ? T.pick(it.x, it.y, 40) : null, ok = hit ? T.tap(hit) : false;
    return { people: N.list().length, beasts: A.all().length, kinds: Object.keys(A.KINDS).length || A.KINDS.length, live: live.length, hit: hit && hit.kind, tapped: ok, active: T.active(), card: document.getElementById('encounter').innerText.replace(/\s+/g, ' ').slice(0, 60) };
  });
  await ev(() => { DG.talk.close(); });
  check('go.npc 주민·짐승 — 주민 10·짐승 15(5종), 주민 곁에서 말을 걸면 대화 카드가 뜬다',
    nc.people === 10 && nc.beasts === 15 && nc.kinds === 5 && nc.hit === 'npc' && (nc.active || nc.card.length > 0), JSON.stringify(nc));

  /* go.region — 권역 넷 × 9, 절차 인물은 같은 입력 = 같은 사람, find(id) 왕복 */
  const rg = await ev(() => {
    var regs = ['regionKr', 'regionJp', 'regionCn', 'regionXy'].map((k) => DG[k] ? DG[k].REGIONS.length : 0);
    var code = DG.regionKr.REGIONS[0].code, a = DG.genchar.hero(code, 3, 7), b = DG.genchar.hero(code, 3, 7), c = DG.genchar.hero(code, 3, 8), back = DG.genchar.find(a.id);
    return { regs: regs, same: JSON.stringify(a) === JSON.stringify(b), differ: a.name !== c.name || a.id !== c.id, id: a.id, back: back && back.name === a.name };
  });
  check('go.region 권역·절차 인물 — 권역 넷 × 9, 같은 입력은 같은 사람, 다른 번호는 다른 사람, id 로 되찾으면 같다',
    rg.regs.every((n) => n === 9) && rg.same && rg.differ && rg.back, JSON.stringify(rg));

  /* go.sprite — 같은 인물은 늘 같은 모양, 120명에서 모양 50가지 이상 */
  const sp = await ev(() => { var S = DG.sprite, hs = DG.data.heroes.slice(0, 120), looks = {}; hs.forEach((h) => { looks[JSON.stringify(S.lookOf(h))] = 1; }); var h0 = hs[0]; return { same: JSON.stringify(S.lookOf(h0)) === JSON.stringify(S.lookOf(h0)), distinct: Object.keys(looks).length, seed: S.idSeed(h0.id) === S.idSeed(h0.id) }; });
  check('go.sprite 2D 스프라이트 — 같은 인물은 늘 같은 모양, 인물 120명에서 모양이 50가지 이상', sp.same && sp.seed && sp.distinct >= 50, JSON.stringify(sp));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|overpass|Failed to fetch/i.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-close2.json', JSON.stringify({ script: 'pw-go-close2.mjs', game: 'saga-go', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
