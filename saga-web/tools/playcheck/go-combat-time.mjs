// 사가만리 Q6 ② — 들판 무리 하나를 **게임 시간**으로 잡는 데 몇 초 걸리나(화면 속도와 상관없이 판정만 1/30초씩 돌린다)
// 🤖 자동 전투가 누르는 대로 · 나는 제자리(적이 온다) · 무리 꼴마다(보통·정예·우두머리) 한 번씩
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  const TUNE = (process.argv.find((a) => a.startsWith('tune=')) || '').slice(5);   // 예: tune=field.shieldBase:0,field.hpBase:300
  const kinds = process.argv.slice(2).filter((a) => !a.startsWith('tune='));
  if (!kinds.length) { kinds.push('plain', 'elite', 'boss'); }
  await c.ev(`(function(){ var t = '${TUNE}'; if (!t) return; t.split(',').forEach(function(kv){ var p = kv.split(':'); DG.core.setTune(p[0], +p[1]); }); })()`);
  for (const kind of kinds) {
    const r = await c.ev(`(function(){
      var FC = DG.fieldCombat, C = DG.core, p = C.save.player.pos, S = FC.state();
      C.save.settings.autoBattle = true;
      /* 이 꼴의 무리를 해시 자리에서 찾는다(가까운 것부터) */
      var found = null, R = 0;
      for (R = 1; R < 30 && !found; R++) for (var gy = -R; gy <= R && !found; gy++) for (var gx = -R; gx <= R && !found; gx++) {
        if (Math.max(Math.abs(gx), Math.abs(gy)) !== R) continue;
        var cp = FC.campAt(gx, gy, function(){ return 'grass'; });
        if (cp && cp.kind === '${kind}' && !cp.sky && !S.cleared[cp.key]) found = cp;
      }
      if (!found) return '${kind}: 못 찾음';
      if (!S.camps[found.key]) FC.spawnCamp(S, found);
      var cm = S.camps[found.key];
      p.x = found.x - 12; p.y = found.y;
      S.party.forEach(function(m){ m.hp = m.hpMax; m.down = false; m.energy = 0; m.skillCd = 0; });
      var dmgT = 0, skills = 0, farT = 0, midT = 0, dt = 1 / 30, t = 0, hurt = 0, hits = 0, swings = 0, maxAlive = 0, first = -1, downs = 0;
      var hp0 = 0; cm.uids.forEach(function(u){ var f = S.foes[u]; hp0 += f.hpMax + (f.shieldMax || 0); });
      var names = cm.uids.map(function(u){ return S.foes[u].name + '(' + S.foes[u].hpMax + (S.foes[u].shieldMax ? '+방패' + S.foes[u].shieldMax : '') + ')'; });
      var realDrain = FC.drain;
      while (t < 240) {
        var hpB = 0; cm.uids.forEach(function(u){ var f = S.foes[u]; if (f) hpB += Math.max(0, f.hp) + Math.max(0, f.shield || 0); }); var cb = S.combo, sk = (S.party[S.active] || {}).skillCd;
        FC.tick(dt); t += dt;
        var hpA = 0; cm.uids.forEach(function(u){ var f = S.foes[u]; if (f) hpA += Math.max(0, f.hp) + Math.max(0, f.shield || 0); }); dmgT += hpB - hpA;
        if (S.combo !== cb) swings++; if ((S.party[S.active] || {}).skillCd > sk + 1) skills++;
        var nf = null, nd2 = 1e9; cm.uids.forEach(function(u){ var f = S.foes[u]; if (f && f.hp > 0 && !f.dead) { var dd = Math.hypot(f.x - p.x, f.y - p.y) - FC.BODY(f); if (dd < nd2) { nd2 = dd; nf = f; } } }); if (nd2 > 6) farT += dt; else if (nd2 > 3.2) midT += dt;
        var alive = cm.uids.filter(function(u){ var f = S.foes[u]; return f && f.hp > 0 && !f.dead; }).length;
        if (first < 0 && FC.engaged(S)) first = t;
        if (!alive) break;
        if (S.party.every(function(m){ return m.down; })) { downs = 1; break; }
      }
      var m = S.party[S.active];
      var out = '${kind} 등급' + found.tier + ' [' + names.join(' ') + '] 합 ' + hp0 + ' → ' + (downs ? '전멸 ' : '다 잡음 ') + t.toFixed(1) + '초(교전 ' + (t - Math.max(0, first)).toFixed(1) + ') · 편성 ' + S.party.length + '명 공격 ' + S.party.map(function(x){ return Math.round(x.atk) + (x.el ? x.el[0] : ''); }).join('/') + ' · 체력 ' + S.party.map(function(x){ return Math.round(x.hp) + '/' + Math.round(x.hpMax); }).join(' ');
      out += ' · 휘두름 ' + swings + '번(' + (swings / t).toFixed(2) + '/초) · 스킬 ' + skills + ' · 피해 ' + Math.round(dmgT) + '(' + Math.round(dmgT / t) + '/초) · 적이 6m 밖 ' + farT.toFixed(1) + 's · 3.2~6m ' + midT.toFixed(1) + 's';
      C.save.settings.autoBattle = false;
      return out;
    })()`);
    console.log(r);
  }
  await c.ev(`(function(){ var t = '${TUNE}'; if (!t) return; t.split(',').forEach(function(kv){ DG.core.setTune(kv.split(':')[0], null); }); })()`);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
