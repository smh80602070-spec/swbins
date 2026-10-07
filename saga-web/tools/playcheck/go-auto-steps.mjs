// 사가만리 Q5 — 단계 종류마다 그 첫 자리로 이야기를 옮겨 놓고 🤖📖 자동이 풀어내는지(단계가 넘어가는지) 따로 잰다
// 인자: 종류 목록(기본 follow seal climb defend chase sail sky) · 초(한 종류당, 기본 150) · all(그 종류의 모든 자리)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const args = process.argv.slice(2);
const SECS = +(args.find((a) => /^\d+$/.test(a)) || 150);
const ALL = args.includes('all');
const TYPES = args.filter((a) => !/^\d+$/.test(a) && a !== 'all');
if (!TYPES.length) { TYPES.push('follow', 'seal', 'climb', 'defend', 'chase', 'sail', 'sky'); }
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS * 12 + 120) * 1000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('자동'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.perf.pin('LOW'); DG.core.save.settings.autoBattle = true; DG.auto.setOn(true); DG.core.save.player.level = Math.max(DG.core.save.player.level || 1, 60);`);
  const spots = JSON.parse(await c.ev(`(function(){
    var out = [], seen = {}, want = ${JSON.stringify(TYPES)};
    DG.story.CHAPTERS.forEach(function (ch, ci) { ch.steps.forEach(function (st, si) {
      var k = st.type + (st.pole ? ':pole' : '') + (st.pad ? ':pad' : '');
      if (want.indexOf(st.type) < 0 || (!${ALL} && seen[k])) { return; }
      seen[k] = 1; out.push({ ch: ci, i: si, k: k, text: st.text });
    }); });
    return JSON.stringify(out);
  })()`));
  for (const sp of spots) {
    await c.ev(`(function(){ var sv = DG.story.state(); sv.ch = ${sp.ch}; sv.step = ${sp.i}; var t = DG.story.targetOf(DG.story.step()), p = DG.core.save.player.pos; if (t) { p.x = t.x - 25; p.y = t.y; } })()`);
    const t0 = Date.now(); let res = '', last = '';
    while (Date.now() - t0 < SECS * 1000) {
      await sleep(3000);
      const r = JSON.parse(await c.ev(`JSON.stringify({ ch: DG.story.state().ch, i: DG.story.state().step, doing: DG.auto.status().doing })`));
      last = r.doing;
      if (process.argv.includes('trace') && Math.round((Date.now() - t0) / 1000) % 15 < 3) { console.log('   ', Math.round((Date.now() - t0) / 1000) + 's', r.doing.slice(0, 60), await c.ev(`(function(){ var FS = DG.fieldCombat.state(), p = DG.core.save.player.pos, g = ''; for (var u in FS.foes) { var f = FS.foes[u]; if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 40) g += ' ' + f.name + ' ' + Math.round(f.hp) + '/' + f.hpMax + ' ' + f.st + ' ' + Math.round(Math.hypot(f.x - p.x, f.y - p.y)) + 'm'; } return '나 ' + FS.party.map(function(m){ return Math.round(m.hp); }).join('/') + ' ·' + g + ' · inCombat ' + DG.fieldCombat.inCombat(FS, p.x, p.y); })()`)); }
      if (r.ch !== sp.ch || r.i !== sp.i) { res = '넘어감 ' + Math.round((Date.now() - t0) / 1000) + 's'; break; }
    }
    console.log((res ? '✓ ' : '✗ ') + sp.k.padEnd(12) + (sp.ch + 1) + '장 ' + (sp.i + 1) + '단계 ' + (res || '멈춤') + ' · ' + last.slice(0, 90));
  }
  await c.ev(`DG.auto.setOn(false); DG.core.save.settings.autoBattle = false; DG.perf.unpin(); DG.core.setTune('perf.auto', null);`);
  if (c.logs.length) { console.log(c.logs.slice(0, 6).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
