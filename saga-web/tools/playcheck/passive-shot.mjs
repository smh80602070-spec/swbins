// node saga-web/tools/playcheck/passive-shot.mjs <판> → shots/passive_<판>_{390,1280}.png (W-0180~)
// 패시브 그물(공용 passive-web-ui.js) 겹창을 판 안에서 실제로 열고 몇 마디 찍은 상태 — 카드(경로 점수)·검색 표시까지 띄워 두 크기로 찍는다.
// 판마다 여는 법은 OPEN 표(판을 잇는 티켓이 한 줄씩 더한다).
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
  await c.go(B + 'index.html', 5000);
  await c.ev(`DG.account && DG.account.create && DG.account.create('경락')`);
  await c.go(B + 'index.html', 7000);
  await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
  await sleep(4000);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  await c.ev(`(function(){ var cs = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cs.length; i++) cs[i].click(); var b = document.querySelector('.stc-btn'); if (b) b.click(); })()`);
  await sleep(2500);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
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
    const bad = !lay.open || lay.over || lay.clip;
    if (bad) { fails++; }
    console.log(`${w}x${h} ${bad ? 'FAIL' : 'ok'} ${JSON.stringify(lay)}`);
    console.log('  →', await c.shot(`passive_${GAME}_${w}`));
  }
  if (c.logs.length) { console.log('콘솔', c.logs.slice(0, 5).join(' | ')); }
} catch (e) { console.log('ERR', e.message); fails++; }
clearTimeout(hard); await c.close(); srv.kill();
console.log(fails ? `PASSIVE-SHOT FAIL ${fails}` : 'PASSIVE-SHOT OK');
process.exit(fails ? 1 : 0);
