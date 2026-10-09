// 사가나락 2D 던전 방 벨트 스크롤(W-0128) 확인 — PC·폰 세로·가로, 1층 방 들어가 두 장(처음·오른쪽 끝). shots/belt/<태그>-<화면>-<n>.png
//   node pw-belt-check.mjs [태그]   (서버는 스스로 빈 포트에 띄우고 끈다)
import net from 'node:net'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), PC = HERE, OUT = path.join(PC, 'shots', 'belt'); fs.mkdirSync(OUT, { recursive: true });
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const srv = spawn(process.execPath, [path.join(PC, 'serve.mjs'), path.resolve(PC, '..', '..'), String(port)], { stdio: 'ignore' });
process.env.PW_BASE = `http://127.0.0.1:${port}/`;
const { open, sleep } = await import('./pw.mjs'); await sleep(800);
const tag = process.argv[2] || 'a';
const VIEWS = [{ k: 'pc', w: 1280, h: 720 }, { k: 'phone', w: 390, h: 844, mobile: true }, { k: 'land', w: 844, h: 390, mobile: true }];
const skip = async (ev) => { for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) b.click(); }); const c = document.getElementById('sheet-close'); if (c && c.offsetParent) c.click(); }); await sleep(300); } };
for (const V of VIEWS) {
  const r = await open('saga-dungeon', V); const ev = (f, a) => r.page.evaluate(f, a);
  try {
    await r.page.goto(r.url('index.html')); await sleep(1500); await ev(() => DG.account.create('belt'));
    await r.page.goto(r.url('index.html')); await sleep(3000);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) b.click(); }); await sleep(3000);
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) b.click(); });
    await sleep(3500); await skip(ev);
    if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(1500); }
    await ev(() => { if (DG.town && DG.town.leave) DG.town.leave(); DG.dungeon.enter({ floor: 1 }); }); await sleep(2500); await skip(ev);
    await ev(() => { const R = DG.dungeon.raw(); if (R) { R.hp = R.hpMax = 999999; } });
    if (process.argv.includes('beasts')) {   // 그림 확인용 — 적 몇을 사람형이 아닌 몸으로(판정과 무관)
      console.log(V.k, '몬스터', JSON.stringify(await ev(() => { const R = DG.dungeon.raw(), ED = DG.enemyData, pick = ['quad', 'bird', 'serpent', 'ogre', 'toad', 'dragon'].map((f) => ED.enemies.find((e) => e.form === f && e.kind !== 'human')).filter(Boolean); const out = []; R.room.enemies.slice(0, pick.length + 1).forEach((e, i) => { e.ref = i < pick.length ? pick[i] : ED.bosses[ED.bosses.length - 1]; e.boss = i >= pick.length; e.x = 240 + i * 70; e.y = 120 + (i % 3) * 110; e.aggro = false; out.push(e.ref.name + '→' + (DG.monsterPortrait.idOf(e.ref, e.boss) || '-')); }); R.player.x = 420; return out; })));
      await sleep(2500);
    }
    await sleep(1500);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-1.png`) });
    const info = await ev(() => { const R = DG.dungeon.raw(); return { belt: DG.belt2d.want(R), px: Math.round(R.player.x), py: Math.round(R.player.y), foes: R.room.enemies.length, kind: R.room.kind }; });
    await ev(() => { const R = DG.dungeon.raw(); R.player.x = DG.dungeon.ROOM_W - 120; R.player.y = DG.dungeon.ROOM_H * 0.7; }); await sleep(1200);
    await r.page.screenshot({ path: path.join(OUT, `${tag}-${V.k}-2.png`) });
    console.log(V.k, JSON.stringify(info), r.errors.filter((e) => !/404|ERR_CONN/.test(e)).slice(0, 3).join(' | '));
  } catch (e) { console.log(V.k, 'ERR', e.message.split('\n')[0]); }
  await r.close();
}
srv.kill(); process.exit(0);
