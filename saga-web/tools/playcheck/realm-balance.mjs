// 5천하 장 흐름 균형(W-0454) — 장 1~16 을 장마다 씨앗 N 개로 자동 전투(양쪽 AI)해서 이긴 비율·남은 체력. 스킬 켬/끔 비교
//   node realm-balance.mjs [N=24]   (서버 :8871) → 콘솔 표 + results/realm-balance.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), N = +(process.argv[2] || 24);
const r = await open('saga-realm', { w: 800, h: 600 });
const ev = (f, a) => r.page.evaluate(f, a);
const click = (s) => ev((x) => { const b = document.querySelector(x); if (b) { b.click(); return true; } return false; }, s);
let out = null;
try {
  await r.page.goto(r.url('index.html?mode=2d')); await sleep(1500); await ev(() => { localStorage.clear(); DG.account.create('균형'); });
  await r.page.goto(r.url('index.html?mode=2d')); await sleep(2500); await click('#title-continue'); await sleep(2000);
  await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(600); await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);
  out = await ev(([n, tune]) => {
    const T = DG.tactics, CP = DG.campaign, C = DG.core, rows = [];
    Object.keys(tune).forEach((k) => C.setTune(k, tune[k]));   // W-0455 PC_TUNE='{"rtk.command":0}' 식으로 손잡이 비교
    for (const sk of [1, 0]) {
      C.setTune('rtk.heroSkill', sk);
      for (let ch = 1; ch <= 16; ch++) {
        let win = 0, hp = 0, turns = 0;
        for (let s = 0; s < n; s++) {
          const o = CP.battleOpts(ch); o.seed = 'bal|' + ch + '|' + s;
          if (DG.command && !tune.noPick) { const fa = DG.command.foeArms(o.seed, o.foes), win = { cav: 'spear', bow: 'cav', spear: 'bow' }; o.mercs = {}; o.mine.forEach((id, i) => { const f2 = fa[i % Math.max(1, fa.length)] || ['spear', 'spear']; o.mercs[id] = [win[f2[0]], win[f2[1]]]; }); }   // W-0455 사람처럼 — 적 편성 보고 상성 맞춤
          const b = T.makeBoardSrpg(o.seed, o.land, o.siege, o.goal); T.unitsOfSrpg(b, o.mine, o.foes, o.foeTroops, o, o.myTroops);
          T.autoPlay(b); const ou = T.outcome(b);
          if (ou && (ou.kind === 'rout' || ou.kind === 'win')) { win++; } hp += ou ? ou.hpMe : 0; turns += b.turn;
        }
        rows.push({ sk, ch, win: Math.round(100 * win / n), hp: Math.round(hp / n), turns: +(turns / n).toFixed(1) });
      }
    }
    C.setTune('rtk.heroSkill', 1);
    return rows;
  }, [N, JSON.parse(process.env.PC_TUNE || '{}')]);
  const by = {}; out.forEach((x) => { (by[x.ch] = by[x.ch] || {})[x.sk ? 'on' : 'off'] = x; });
  console.log('장  | 스킬 켬 승률·체력·턴 | 끔');
  Object.keys(by).forEach((ch) => { const a = by[ch].on, b = by[ch].off; console.log(String(ch).padStart(2), '|', String(a.win).padStart(3) + '%', String(a.hp).padStart(3), String(a.turns).padStart(4), '|', String(b.win).padStart(3) + '%', String(b.hp).padStart(3), String(b.turns).padStart(4)); });
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'realm-balance.json'), JSON.stringify({ at: new Date().toISOString(), n: N, rows: out }, null, 1));
await r.close();
