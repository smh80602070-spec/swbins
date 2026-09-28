// 사가고 — 한 장을 처음부터 🤖📖 자동으로: 그 장 첫 단계로 옮겨 놓고 단계가 넘어가는 시각·doing 을 적는다 + 단계마다 사진(shots/go_ch<N>_s<i>)
// 인자: 장 번호(1부터, 기본 24) · 초(기본 300) · nofield(들판 무리 끔 — 헤드리스는 느려 곁 무리에 끌려간다)
// PC_PROF=tmp/… 새 프로필로 돌릴 것(저장된 자동·이야기 자리가 남으면 헛결과)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const nums = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
const CH = nums[0] || 24, SECS = nums[1] || 300;
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 120) * 1000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('장자동'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.save.settings.autoBattle = true; DG.core.save.player.level = 60;
    ${process.argv.includes('nofield') ? "DG.core.setTune('field.on', 0);" : ''}
    DG.fieldCombat._resetForTest && DG.fieldCombat._resetForTest();
    var sv = DG.story.state(); sv.ch = ${CH - 1}; sv.step = ${process.argv.includes('defend') ? "DG.story.CHAPTERS[" + (CH - 1) + "].steps.findIndex(function (x) { return x.type === 'defend'; })" : 0};
    var t = DG.story.targetOf(DG.story.step()), p = DG.core.save.player.pos; p.x = t.x + 15; p.y = t.y; DG.world.walkTo(p.x, p.y);
    DG.auto.setOn(true);
    return JSON.stringify({ ch: DG.story.chapter().name, steps: DG.story.CHAPTERS[${CH - 1}].steps.length });
  })()`));
  const t0 = Date.now(); let last = -1;
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(2500);
    const r = JSON.parse(await c.ev(`JSON.stringify({ ch: DG.story.state().ch, i: DG.story.state().step, doing: DG.auto.status().doing, sky: DG.landform.onSky() })`));
    if (r.i !== last || r.ch !== CH - 1) {
      console.log(Math.round((Date.now() - t0) / 1000) + 's', (r.ch + 1) + '장 ' + (r.i + 1) + '단계', r.sky ? '[섬 위]' : '', r.doing.slice(0, 80));
      if (r.ch === CH - 1) { await c.shot('go_ch' + CH + '_s' + (r.i + 1)); }
      last = r.i;
    }
    if (process.argv.includes('trace') && Math.round((Date.now() - t0) / 1000) % 20 < 3) { console.log('   ', await c.ev(`(function(){ var FS = DG.fieldCombat.state(), p = DG.core.save.player.pos, g = ''; if (!FS) { return '전투 상태 없음'; } for (var u in FS.foes) { var f = FS.foes[u]; if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 40) { g += ' ' + f.kind + ' ' + Math.round(f.hp) + '/' + f.hpMax + (f.sky ? '☁' : '') + ' ' + f.st + ' ' + Math.round(Math.hypot(f.x - p.x, f.y - p.y)) + 'm'; } } return '나 ' + FS.party.map(function (m) { return Math.round(m.hp); }).join('/') + (DG.landform.onSky() ? ' ☁' : '') + ' ·' + g; })()`)); }
    if (r.ch !== CH - 1) { console.log('장 끝'); break; }
  }
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
