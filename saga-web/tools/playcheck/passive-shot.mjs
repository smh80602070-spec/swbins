// node saga-web/tools/playcheck/passive-shot.mjs <판> → shots/passive_<판>_{390,1280}.png (W-0180~)
// 패시브 그물(공용 passive-web-ui.js) 겹창을 판 안에서 실제로 열고 몇 마디 찍은 상태 — 카드(경로 점수)·검색 표시까지 띄워 두 크기로 찍는다.
// 판마다 여는 법은 OPEN·BOOT 표(판을 잇는 티켓이 한 줄씩 더한다).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = process.argv[2] || 'saga-dungeon';
/** 판 → 페이지 안에서 겹창을 여는 식(찍기 몇 개 포함). 돌려주는 글은 기록 줄 */
const OPEN = {
  'saga-dungeon': `(function(){
    var C = DG.core, MR = DG.meridian, id = C.save.party[0];
    C.save.heroes[id] = C.save.heroes[id] || { lv: 1, exp: 0, rank: 0 }; C.save.heroes[id].lv = 24;
    C.save.passive = {}; MR._reset();
    var api = MR.api(id), cls = DG.skill.classOf(id).key;
    api.take('o_' + cls);
    /* 가까운 이름난 둘까지 찍고, 다음 이름난 하나는 카드로 띄운다(경로 점수) */
    function nearest() { var b = null; DG.passiveDef.nodes.forEach(function (n) { if (n.k !== 'n' || api.isTaken(n.id)) return; var p = api.pathTo(n.id); if (p && (!b || p.cost < b.cost)) b = { id: n.id, cost: p.cost }; }); return b; }
    api.takePath(nearest().id); api.takePath(nearest().id);
    var ui = MR.open(id), nx = nearest();
    ui.select(nx.id);
    var q = document.querySelector('.pwui-q'); q.value = '치명'; q.dispatchEvent(new Event('input'));
    return cls + ' · 찍음 ' + api.used() + '/' + api.points() + ' · 카드 ' + nx.id + ' ' + nx.cost + '점';
  })()`,
  /* W-0181 — 주 메뉴 「성도」 단추를 실제로 눌러 열리는지 본 뒤, 같은 겹창을 다시 열어 카드를 띄운다 */
  'saga-go': `(function(){
    var C = DG.core, SC = DG.starchart, b = {}, i;
    for (i = 0; i < 20; i++) { b['shot_' + i] = true; }
    C.save.beacons = b; C.save.passive = { start: null, taken: [] }; SC._reset();
    var btn = document.getElementById('btn-star'); if (btn) { btn.click(); }
    var clicked = !!(DG.passiveWebUI && DG.passiveWebUI.isOpen());
    var api = SC.api(); api.take('o_roamer');
    function nearest() { var b = null; DG.passiveDef.nodes.forEach(function (n) { if (n.k !== 'n' || api.isTaken(n.id)) return; var p = api.pathTo(n.id); if (p && (!b || p.cost < b.cost)) b = { id: n.id, cost: p.cost }; }); return b; }
    api.takePath(nearest().id); api.takePath(nearest().id);
    var ui = SC.open(), nx = nearest();
    ui.select(nx.id);
    var q = document.querySelector('.pwui-q'); q.value = '이동'; q.dispatchEvent(new Event('input'));
    return '단추 ' + (clicked ? '열림' : '안 열림') + ' · 찍음 ' + api.used() + '/' + api.points() + ' · 카드 ' + nx.id + ' ' + nx.cost + '점';
  })()`,
  /* W-0182 — 상단 「🧭」 단추를 눌러 열리는지 본 뒤, 내 세력 경륜도를 다시 열어 카드를 띄운다 */
  'saga-realm': `(function(){
    var R = DG.rtk, SC = DG.statecraft;
    if (!R.state().started) { R.setup('cao'); }
    var f = R.force(R.me()), won = {}, i;
    for (i = 0; i < 20; i++) { won['shot_' + i] = 1; }
    f.passive = { start: null, taken: [], won: won }; SC._reset(); DG.core.emit('changed');
    var btn = document.getElementById('btn-gyeong'), glow = btn ? btn.style.boxShadow : '';
    if (btn) { btn.click(); }
    var clicked = !!(DG.passiveWebUI && DG.passiveWebUI.isOpen());
    var api = SC.api(R.me()); api.take('o_mokmin');
    function nearest() { var b = null; DG.passiveDef.nodes.forEach(function (n) { if (n.k !== 'n' || api.isTaken(n.id)) return; var p = api.pathTo(n.id); if (p && (!b || p.cost < b.cost)) b = { id: n.id, cost: p.cost }; }); return b; }
    api.takePath(nearest().id); api.takePath(nearest().id);
    var ui = SC.open(), nx = nearest();
    ui.select(nx.id);
    var q = document.querySelector('.pwui-q'); q.value = '금'; q.dispatchEvent(new Event('input'));
    return '단추 ' + (clicked ? '열림' : '안 열림') + (glow ? '(금빛 테)' : '(테 없음)') + ' · 찍음 ' + api.used() + '/' + api.points() + ' · 카드 ' + nx.id + ' ' + nx.cost + '점';
  })()`,
  /* W-0183 — 무사로 전직, 무예 창의 「✨ 성좌도 열기」 단추를 실제로 눌러 열리는지 본 뒤 카드를 띄운다 */
  'saga-story': `(function(){
    var C = DG.core, CS = DG.constellation, J = DG.job;
    C.save.player.level = 30; C.save.job = 'none'; J.join('warrior');
    C.save.passive = { start: null, taken: [] }; CS._reset();
    DG.ui.openSheet('job');
    var btn = document.querySelector('#sheet-body [data-act="star-open"]'); if (btn) { btn.click(); }
    var clicked = !!(DG.passiveWebUI && DG.passiveWebUI.isOpen());
    var api = CS.api(); api.take('o_warrior');
    function nearest() { var b = null; DG.passiveDef.nodes.forEach(function (n) { if (n.k !== 'n' || api.isTaken(n.id)) return; var p = api.pathTo(n.id); if (p && (!b || p.cost < b.cost)) b = { id: n.id, cost: p.cost }; }); return b; }
    api.takePath(nearest().id); api.takePath(nearest().id);
    var ui = CS.open(), nx = nearest();
    ui.select(nx.id);
    var q = document.querySelector('.pwui-q'); q.value = '이동'; q.dispatchEvent(new Event('input'));
    return '단추 ' + (btn ? (clicked ? '열림' : '안 열림') : '없음') + ' · 찍음 ' + api.used() + '/' + api.points() + ' · 카드 ' + nx.id + ' ' + nx.cost + '점';
  })()`,
};
/** 판마다 부팅 — 계정 만들고 이어하기 */
const BOOT = {
  'saga-dungeon': async (c, B) => {
    await c.go(B + 'index.html', 5000);
    await c.ev(`DG.account && DG.account.create && DG.account.create('경락')`);
    await c.go(B + 'index.html', 7000);
    await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
    await sleep(4000);
    for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
    await c.ev(`(function(){ var cs = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cs.length; i++) cs[i].click(); var b = document.querySelector('.stc-btn'); if (b) b.click(); })()`);
    await sleep(2500);
    for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  },
  'saga-go': async (c, B) => {
    await c.go(B + 'index.html', 6000);
    await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('성도'); } })()`);
    await c.go(B + 'index.html', 8000);
    await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
    await sleep(4000);
    for (let i = 0; i < 6; i++) { await c.key('Escape', 60); await sleep(200); }
  },
  /* 5천하 — 계정 → 이어하기 → 시나리오·세력 고르기(첫 칸) → 3D 국토 지도는 끈다(헤드리스 부하) */
  'saga-realm': async (c, B) => {
    await c.go(B + 'index.html', 5000);
    await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('경륜'); } })()`);
    await c.go(B + 'index.html', 7000);
    await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
    await sleep(3000);
    for (let i = 0; i < 6; i++) { await c.key('Escape', 60); await sleep(200); }
    await c.ev(`(function(){ var h = document.getElementById('help-ok'); if (h && h.offsetParent) h.click(); var s = document.querySelector('[data-act="pick-scen"]'); if (s) s.click(); })()`);
    await sleep(900);
    await c.ev(`(function(){ var f = document.querySelector('[data-act="pick-force"]'); if (f) f.click(); })()`);
    await sleep(3000);
    for (let i = 0; i < 8; i++) { await c.key('Escape', 60); await sleep(200); }
    await c.ev(`(function(){ if (DG.realm3d && DG.realm3d.active && DG.realm3d.active()) { document.getElementById('btn-3d').click(); } })()`);
    await sleep(1500);
  },
  'saga-story': async (c, B) => {
    await c.go(B + 'index.html', 6000);
    await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('성좌'); } })()`);
    await c.go(B + 'index.html', 8000);
    await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
    await sleep(4000);
    for (let i = 0; i < 6; i++) { await c.key('Escape', 60); await sleep(200); }
  },
};
if (!OPEN[GAME]) { console.log('모르는 판 ' + GAME + ' — OPEN 표에 한 줄 더할 것'); process.exit(2); }
const PORT = 8931, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', GAME)], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 200000);
let fails = 0;
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await BOOT[GAME](c, B);
  console.log('열기', await c.ev(OPEN[GAME]));
  for (const [w, h, mobile] of [[390, 844, true], [1280, 720, false]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    await c.ev(`window.dispatchEvent(new Event('resize'))`);
    await sleep(900);
    /* 겹침 점검 — 카드·위 막대가 서로 겹치거나 화면 밖으로 잘리면 FAIL */
    const lay = JSON.parse(await c.ev(`(function(){
      function R(s){ var e = document.querySelector(s); if (!e || e.hidden) return null; var r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; }
      var top = R('.pwui-top'), card = R('.pwui-card'), q = R('.pwui-q'), W = innerWidth, H = innerHeight;
      var over = card && top && card.t < top.b, clip = [top, card, q].some(function (x) { return x && (x.l < 0 || x.r > W || x.t < 0 || x.b > H); });
      var title = document.querySelector('.pwui-title'), cut = title && title.scrollWidth > title.clientWidth + 1;
      return JSON.stringify({ top: top, card: card, over: !!over, clip: clip, titleCut: !!cut, open: !!document.querySelector('.pwui') });
    })()`));
    const bad = !lay.open || lay.over || lay.clip || lay.titleCut;
    if (bad) { fails++; }
    console.log(`${w}x${h} ${bad ? 'FAIL' : 'ok'} ${JSON.stringify(lay)}`);
    console.log('  →', await c.shot(`passive_${GAME}_${w}`));
  }
  if (c.logs.length) { console.log('콘솔', c.logs.slice(0, 5).join(' | ')); }
} catch (e) { console.log('ERR', e.message); fails++; }
clearTimeout(hard); await c.close(); srv.kill();
console.log(fails ? `PASSIVE-SHOT FAIL ${fails}` : 'PASSIVE-SHOT OK');
process.exit(fails ? 1 : 0);
