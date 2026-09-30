// 사가스토리 5부 문 너머: 사냥터 셋(beyond_past·now·future)에 들어가 3D 가 예외 없이 그려지나 · 적·보스가 서나 · 문 사슬(암굴 → 셋) · 보스가 제 몸을 받나
// 사진은 `shot` 을 줄 때만(shots/st_beyond_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('문너머'); } })()`);
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ if (DG.story.isOpen()) DG.story.skip(); DG.core.save.player.level = 80; if (DG.auto.active()) { DG.auto.toggle(); } })()`);
  for (const key of ['deepcave', 'beyond_past', 'beyond_now', 'beyond_future']) {
    console.log(key, await c.ev(`(function(){
      if (DG.side.active()) { DG.side.leave(); }
      DG.side.enter('${key}');
      return 'entered';
    })()`));
    await sleep(3500);
    console.log('  ', await c.ev(`(function(){
      var r = DG.side.raw(), st = r.stage;
      return JSON.stringify({ active: DG.side.active(), stage: st.key, name: st.name, w: st.width, enemies: r.enemies.length, boss: r.boss ? r.boss.ref.name : null,
        portals: st.portals.map(function (p) { return p[1]; }), gl3d: !!(DG.sideView3d && DG.sideView3d.active && DG.sideView3d.active()) });
    })()`));
    if (shot) { await c.shot('st_beyond_' + key); }
  }
  console.log('보스 몸', await c.ev(`(function(){ var A = DG.asset3d, out = {}; ['전장 원혼 장수', '폐허 도심 통제관', '궤도 기지 감시관'].forEach(function (n) { var r = A.fixedRecipe(n); out[n] = r ? r.body.split('/').pop() : null; }); return JSON.stringify(out); })()`));
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 6).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
