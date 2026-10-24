// 2나락 들판 "갑자기 생긴 적" 탐침(W-0327) — 마을 들판을 SEC 초 걸으며 0.2초마다 적 목록을 보고,
//   처음 본 적이 그 순간 **화면 안**(카메라 투영 −1..1, 여유 5%)이면 popin 으로 센다. 등장 연출(bornAt)이 있으면 따로 센다.
//   node dg-popin.mjs [--sec=60] [--phone]   (서버 :8871 — 돌리는 쪽이 띄우고 끈다)   → results/dg-popin[-phone].json
//   투영: 적 (x, y) → 3D 세계 (x − ox, 0, y − oy). ox·oy 는 내 몸(게임 자리 ↔ 3D 노드)에서 잰다(마을 앵커 재기준 대비).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SEC = +opt('sec', 60), PHONE = argv.includes('--phone');
const r = await open('saga-dungeon', PHONE ? { w: 390, h: 844, mobile: true, gpu: !process.env.PW_SWIFT } : { w: 1600, h: 900, gpu: !process.env.PW_SWIFT });
const out = { at: new Date().toISOString(), phone: PHONE, sec: SEC, samples: 0, seen: 0, popin: 0, appear: 0, offscreen: 0, list: [], probe: null };
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await r.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} DG.account.create('팝인'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(3500);
  await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2000);
  await r.page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  await sleep(9000); await clearOverlays(r.page, 'saga-dungeon');
  /* 좌표 관계 — 내 몸 노드의 3D 자리와 게임 자리 차이 */
  out.probe = await r.page.evaluate(() => {
    const D3 = DG.dungeon3d, T = D3.three(), sc = (() => { const n = new T.Object3D(); D3.addFx(n); let s = n.parent; n.parent.remove(n); while (s && s.parent) { s = s.parent; } return s; })();
    let me = null; sc.traverse((o) => { if (!me && o.userData && o.userData.mixerNode && o.userData.actorKey === 'me') { me = o; } });
    const ctx = DG.town.raw(), p = ctx && ctx.player; return { mode: D3.active && D3.active() ? '3d' : '2d', hasMe: !!me, player: p ? [Math.round(p.x), Math.round(p.y)] : null, anchor: ctx && ctx.anchor ? [ctx.anchor.x, ctx.anchor.y] : null, radius: DG.spawnView ? Math.round(DG.spawnView.radius()) : null, meScreen: p && DG.dungeonView && DG.dungeonView._proj ? (function (q) { return [Math.round(q.x / innerWidth * 100), Math.round(q.y / innerHeight * 100)]; })(DG.dungeonView._proj(p.x, p.y)) : null };   // 2D 투영 확인 — 나 = 화면 % (가운데 근처여야)
  });
  /* 걷기 + 표본 — 페이지 안에서 돈다(evaluate 왕복 지연 없이 0.2초 간격) */
  const res = await r.page.evaluate(async (SEC) => {
    const D3 = DG.dungeon3d, T = D3.three(), v = new T.Vector3(), seen = new Map(), list = [];
    let n = 0, popin = 0, appear = 0, off = 0, k = 0;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 8초마다 방향을 바꿔 걷는다(town.setInput — 키와 같은 길)
    let cur = null, t0 = performance.now(), lastTurn = -1;
    /* 3D 세계 ↔ 게임: 집 노드(위치 = 게임 o.x,o.y) 기준이 아니라 내 자리로 — 화면 가운데 땅 ≈ 나. 적 게임 자리 − 내 게임 자리 + 내 3D 자리 */
    const meWorld = () => { const ctx = DG.town.raw(); return ctx ? ctx.player : null; };
    while (performance.now() - t0 < SEC * 1000) {
      const sec = Math.floor((performance.now() - t0) / 8000);
      if (sec !== lastTurn) { cur = dirs[sec % 4]; DG.town.setInput(cur[0], cur[1]); lastTurn = sec; }
      const is3 = !!(D3.active && D3.active()), DV = DG.dungeonView;   /* 2D(폰 기본)는 3D 카메라가 없다 — 2D 투영(dungeonView._proj, 캔버스 px)으로 센다 */
      const ctx = DG.town.raw(), cam = D3.camNode(); if (!ctx || (is3 && !cam) || (!is3 && !(DV && DV._proj))) { await new Promise((r) => setTimeout(r, 200)); continue; }
      const es = ctx.room.enemies || [], me = ctx.player; n++;
      /* 3D 노드 자리를 직접 못 얻으니: 카메라가 보는 땅 가운데 = 나(카메라가 따라감). 적 3D = 내 3D(카메라 표적) + (적 − 나) */
      const ray = new T.Raycaster(), ndc = new T.Vector2(0, 0), c0 = new T.Vector3(), pl = new T.Plane(new T.Vector3(0, 1, 0), 0);
      if (is3) { cam.updateMatrixWorld(); ray.setFromCamera(ndc, cam); ray.ray.intersectPlane(pl, c0); }
      const VW = innerWidth, VH = innerHeight;
      for (const e of es) {
        if (!e || e.hp <= 0) { continue; }
        if (!e.__pid) { e.__pid = ++k; }
        if (seen.has(e.__pid)) { continue; }
        seen.set(e.__pid, true);
        if (is3) { v.set(c0.x + (e.x - me.x), 10, c0.z + (e.y - me.y)); v.project(cam); } else { const q = DV._proj(e.x, e.y); v.set(q.x / VW * 2 - 1, 1 - q.y / VH * 2, 0); }
        const inView = Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 && v.z < 1;
        const d = Math.round(Math.hypot(e.x - me.x, e.y - me.y));
        if (n <= 2) { continue; }   // 처음 두 표본 = 진입 때 이미 있던 적(진입 스폰은 화면 밖일 수 없다 — 가림막 몫)
        if (!inView) { off++; continue; }
        if (e.bornAt) { appear++; } else { popin++; }
        if (list.length < 20) { list.push({ t: Math.round(performance.now() - t0), d, sx: +v.x.toFixed(2), sy: +v.y.toFixed(2), appear: !!e.bornAt }); }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    DG.town.setInput(0, 0);
    return { samples: n, seen: seen.size, popin, appear, offscreen: off, list };
  }, SEC);
  Object.assign(out, res);
  await r.page.screenshot({ path: path.join(HERE, 'shots', 'dg_popin' + (PHONE ? '_phone' : '') + '.png') });
  console.log(JSON.stringify({ probe: out.probe, samples: out.samples, seen: out.seen, popin: out.popin, appear: out.appear, offscreen: out.offscreen, first: out.list.slice(0, 6) }));
} catch (e) { console.log('ERR', e.message); out.err = e.message; }
out.errors = r.errors.filter((e) => !/404/.test(e)).slice(0, 6);
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'results', 'dg-popin' + (PHONE ? '-phone' : '') + '.json'), JSON.stringify(out, null, 1));
await r.close();
