// 사가스토리 확인 시트(tasks/sheets/saga-story-*.md) 네 기능을 Playwright 로 직접 해 본다.
//   node pw-st-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// (첫 발 장면은 DG.story — Esc 로 넘긴다. 헤드리스 포커스는 pw.mjs 가 켠다)
// 사냥터(허창 들판)에 들어가 실제 키(←→·␣·↑↓·1·M)와 자동 사냥을 본다.
// **기계가 한 확인**(D2 기록)이다 — 움직임의 맛·그림은 사람 눈(D3)이 본다. 결과는 콘솔 + results/pw-st-sheet.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(ok); rows.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-story');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const skipScenes = async () => { for (let i = 0; i < 12 && await ev(() => !!(DG.story && DG.story.isOpen && DG.story.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
const pl = () => ev(() => { var p = DG.side.raw().player; return { x: Math.round(p.x), y: Math.round(p.y), vy: Math.round(p.vy), on: !!p.onGround, climb: !!p.climb, drop: !!p.dropThru }; });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(4000);
  await skipScenes();
  const entered = await ev(() => DG.side.enter('field'));
  await sleep(2000);
  await skipScenes();
  check('준비 — 새 계정이 허창 들판 사냥터에 들어간다', entered === true && await ev(() => DG.side.active()), 'party ' + await ev(() => DG.core.save.party.join()));
  await ev(() => { var R = DG.side.raw(); R.hp = R.hpMax = 99999; });

  /* 1) 물리·조작 */
  const a0 = await pl();
  /* 소프트웨어 렌더링에선 프레임이 느려(dt 상한 0.05) 게임 시간이 실제 시간보다 느리게 흐른다 — 실제 시간으로 속도를 재면 늘 느리게 나온다.
     그래서 키는 페이지 안에서 누르고, 게임 시간은 update(1/60) 을 직접 돌려 센다(결정적 — 로컬 프레임 속도와 무관). */
  const sim = (ticks) => ev((n) => { for (var i = 0; i < n; i++) { DG.side.update(1 / 60); } return null; }, ticks);
  const key = (type, k) => ev(([t, kk]) => { window.dispatchEvent(new KeyboardEvent(t, { key: kk })); }, [type, k]);
  await key('keydown', 'ArrowRight');
  const x0r = (await pl()).x;
  await sim(42);                                    // 게임 시간 0.7초
  const x1r = (await pl()).x;
  await key('keyup', 'ArrowRight'); await sim(30);
  const speed = (x1r - x0r) / 0.7;
  const base = await ev(() => DG.side.SPEED);
  check('물리·조작 — → 를 누르면 오른쪽으로 달린다(기본 속도 ' + base + 'px/s × 인물·직업 보정, 게임 시간 0.7초)', speed > base * 0.8 && speed < base * 1.8, '속도 ' + Math.round(speed) + 'px/s = 기본의 ' + (speed / base).toFixed(2) + '배 (' + (x1r - x0r) + 'px / 0.7s)');

  /* ␣ 점프: 올라갔다가(vy<0) 발판 위에 내려선다. 공중에서 또 눌러도 새 점프(vy≈-475)로 안 바뀐다 */
  await sim(60);
  const jmp = await ev(() => {
    var p = DG.side.raw().player, y0 = p.y, minVy = 0, minY = p.y, air = false, landed = false;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    for (var i = 0; i < 120; i++) { DG.side.update(1 / 60); var q = DG.side.raw().player; if (q.vy < minVy) { minVy = q.vy; } if (q.y < minY) { minY = q.y; } if (!q.onGround) { air = true; } }
    landed = !!DG.side.raw().player.onGround;
    return { minVy: Math.round(minVy), rise: Math.round(y0 - minY), air: air, landed: landed };
  });
  check('물리·조작 — ␣ 로 뛰어올라 공중에 떴다가 발판 위에 내려선다', jmp.air && jmp.minVy < -600 && jmp.rise > 40 && jmp.landed, JSON.stringify(jmp));
  const dbl = await ev(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    for (var i = 0; i < 8; i++) { DG.side.update(1 / 60); }
    var v1 = DG.side.raw().player.vy;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    DG.side.update(1 / 60);
    var v2 = DG.side.raw().player.vy;
    for (var j = 0; j < 90; j++) { DG.side.update(1 / 60); }
    return { v1: Math.round(v1), v2: Math.round(v2), landed: !!DG.side.raw().player.onGround };
  });
  check('물리·조작 — 공중에서 ␣ 를 또 눌러도 다시 뛰지 않는다(발판 위에서만 점프)', dbl.v1 < 0 && dbl.v2 > dbl.v1 && dbl.v2 > -600, JSON.stringify(dbl) + ' (새 점프면 vy≈-730 으로 되돌아간다 — 중력으로 조금 느려지기만 해야)');

  /* 줄·사다리 */
  const rope = await ev(() => { var R = DG.side.raw(), s = R.stage, ro = (s.ropes || [])[0]; return ro ? { x: ro[0], top: ro[1], bottom: ro[2], kind: ro[3] } : null; });
  if (!rope) { check('물리·조작 — 사냥터에 줄·사다리가 있다', false, 'ropes 없음'); }
  else {
    await ev((ro) => { var p = DG.side.raw().player; p.x = ro.x - 10; p.y = ro.bottom - 40; p.vx = 0; p.vy = 0; }, rope);
    await sleep(300);
    const b0 = await pl();
    await key('keydown', 'ArrowUp'); await sim(20);      // 게임 시간 0.33초 — 올라가는 도중
    const mid = await pl();
    await sim(34);
    await key('keyup', 'ArrowUp'); await sim(6);
    const b1 = await pl();     // 줄 끝까지 올라가면 발판에 내려서 매달림이 풀린다
    check('물리·조작 — 줄·사다리 앞에서 ↑ 를 누르면 매달려 올라간다', mid.climb && mid.y < b0.y - 10 && b1.y < b0.y - 30, 'y ' + b0.y + '→(도중 ' + mid.y + ', 매달림 ' + mid.climb + ')→' + b1.y);
    await key('keydown', 'ArrowDown'); await sim(54);
    await key('keyup', 'ArrowDown'); await sim(6);
    const b2 = await pl();
    check('물리·조작 — ↓ 를 누르면 줄을 타고 내려온다', b2.y > b1.y + 20, 'y ' + b1.y + '→' + b2.y);
    await ev(() => { DG.side.letGo && DG.side.letGo(); });
  }

  /* 발판 아래로: 발판 위에서 ↓ + ␣ */
  const plat = await ev(() => { var s = DG.side.raw().stage, p = (s.plats || [])[0]; return p ? { x: p[0], y: p[1], w: p[2] } : null; });
  if (plat) {
    await ev((p) => { var q = DG.side.raw().player; q.x = p.x + p.w / 2; q.y = p.y - DG.side.P_H - 2; q.vx = 0; q.vy = 0; }, plat);
    await sleep(900);
    const c0 = await pl();
    await page.keyboard.down('ArrowDown'); await page.keyboard.press('Space'); await sleep(900); await page.keyboard.up('ArrowDown');
    const c1 = await pl();
    check('물리·조작 — 발판 위에서 ↓+␣ 를 누르면 발판을 뚫고 아래로 내려온다', c0.on && c1.y > c0.y + 20, 'y ' + c0.y + '→' + c1.y + ' (발판 위 ' + c0.on + ')');
  } else { check('물리·조작 — 사냥터에 발판이 있다', false, 'plats 없음'); }

  /* 2) 전투 — 무예(1), 숫자 팝·넉백, 맞은 뒤 무적 */
  const idx = await ev(() => { var R = DG.side.raw(), p = R.player, best = -1; R.enemies.forEach((x, i) => { if (x.hp > 0 && (best < 0 || Math.abs(x.x - p.x) < Math.abs(R.enemies[best].x - p.x))) { best = i; } }); var e = R.enemies[best]; if (e) { p.x = e.x - 50; p.y = e.y; p.vx = 0; p.vy = 0; p.facing = 1; e.hp = e.hpMax = 99999; e.__pw = true; } return best; });
  await sleep(700);
  const eAt = () => ev((i) => { var e = DG.side.raw().enemies.find((x) => x.__pw); return e ? { hp: e.hp, x: Math.round(e.x) } : null; }, idx);
  const near = () => ev((i) => { var R = DG.side.raw(), e = R.enemies.find((x) => x.__pw), p = R.player; if (e) { p.x = e.x - 45; p.y = e.y; p.vx = 0; p.vy = 0; p.facing = 1; p.invuln = 99; R.hp = R.hpMax = 99999; } }, idx);
  await near(); await sleep(300);
  const e0 = await eAt();
  const cd0 = await ev(() => DG.side.status().skills[0].ready);
  /* 1번 키 keydown 을 페이지 안에서 보내고 같은 틱에 쿨다운을 읽는다 — Playwright 왕복 지연(수백 ms) 동안 쿨다운이 풀려 버린다 */
  const cd1 = await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })); return DG.side.status().skills[0].ready; });
  await sleep(450);
  let e1 = await eAt();
  for (let k = 0; k < 10 && e1.hp >= e0.hp; k++) { await near(); await sleep(300); await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' })); }); await sleep(500); e1 = await eAt(); }
  check('전투 — 1번 무예를 쓰면 무예가 쿨다운에 들고 적 체력이 줄고 맞은 적이 밀려난다', cd0 === true && cd1 === false && e1.hp < e0.hp, '무예 준비 ' + cd0 + '→' + cd1 + ' · 체력 ' + e0.hp + '→' + e1.hp + ' · x ' + e0.x + '→' + e1.x);
  const hurt = await ev(() => new Promise((res) => {
    var R = DG.side.raw(), p = R.player, e = R.enemies.filter((x) => x.hp > 0)[0], seenInv = 0, hp0 = R.hp;
    if (!e) { res(null); return; }
    R.hp = R.hpMax = 99999; hp0 = R.hp; p.invuln = 0; p.x = e.x; p.y = e.y;
    var t0 = Date.now(), iv = setInterval(() => { var r2 = DG.side.raw(); if (!r2) { return; } if (r2.player.invuln > seenInv) { seenInv = r2.player.invuln; } if (Date.now() - t0 > 2500) { clearInterval(iv); res({ lost: hp0 - r2.hp, maxInvuln: +seenInv.toFixed(2) }); } }, 30);
  }));
  check('전투 — 적에게 맞으면 피해를 입고 잠깐 무적이 선다', !!hurt && hurt.lost > 0 && hurt.maxInvuln > 0, JSON.stringify(hurt));

  /* 3) 사냥터 사슬 — 레벨 문턱 · M 전체지도 */
  const chain = await ev(() => { DG.core.save.player.level = 1; var s = DG.side.stages().map((x) => ({ k: x.ref.key, need: x.ref.need, open: x.open, town: !!x.ref.town })); return { n: s.length, towns: s.filter((x) => x.town).length, hunt: s.filter((x) => !x.town).length, lockedAt1: s.filter((x) => !x.open).length, ok: s.every((x) => x.open === (x.need <= 1)) }; });
  check('사냥터 사슬 — 레벨 1 에선 문턱(레벨 1/5/12/25…)이 안 넘은 곳이 잠겨 있다', chain.ok && chain.lockedAt1 > 0, JSON.stringify(chain));
  const open5 = await ev(() => { DG.core.save.player.level = 5; var s = DG.side.stages().find((x) => x.ref.need === 5); return s ? s.open : null; });
  check('사냥터 사슬 — 레벨 5 가 되면 레벨 5 사냥터가 열린다', open5 === true, 'open ' + open5);
  await page.keyboard.press('m'); await sleep(700);
  const mapOpen = await ev(() => document.getElementById('owmap') ? document.getElementById('owmap').classList.contains('show') : !!document.querySelector('.owmap.show, #overworld.show, [id*=owmap].show'));
  await page.keyboard.press('m'); await sleep(400);
  const mapClosed = await ev(() => !document.querySelector('.owmap.show, #overworld.show, [id*=owmap].show'));
  check('사냥터 사슬 — M 으로 전체 지도가 열리고 다시 M 으로 닫힌다', mapOpen && mapClosed, '열림 ' + mapOpen + ' · 닫힘 ' + mapClosed);

  /* 4) 자동 사냥 */
  await ev(() => { DG.core.save.player.level = 1; var R = DG.side.raw(); R.hp = R.hpMax = 99999; var p = R.player; p.invuln = 99; });
  await ev(() => { var R = DG.side.raw(), p = R.player, e = R.enemies.filter((x) => x.hp > 0).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; if (e) { p.x = e.x - 60; p.y = e.y; p.vx = 0; p.vy = 0; } });
  await sleep(500);
  const k0 = await ev(() => DG.side.status().kills);
  const g0 = await ev(() => DG.side.raw().gold);
  const x0 = await ev(() => DG.side.raw().player.x);
  await ev(() => { DG.auto.setOn ? DG.auto.setOn(true) : DG.auto.toggle(); });
  await sleep(20000);
  const au = await ev(() => ({ on: DG.auto.active ? DG.auto.active() : null, kills: DG.side.status().kills, gold: DG.side.raw().gold, x: Math.round(DG.side.raw().player.x) }));
  await ev(() => { DG.auto.setOn ? DG.auto.setOn(false) : DG.auto.toggle(); });
  check('자동 사냥 — 켜면 스스로 돌아다니며 적을 잡는다', au.kills > k0 || au.gold > g0 || Math.abs(au.x - x0) > 50, JSON.stringify({ 켜짐: au.on, 처치: [k0, au.kills], 금: [g0, au.gold], x: [Math.round(x0), au.x] }));

  /* 5) 2D 모드 시트(W-0019) — 3D 바탕을 끄면 사람형 적이 새 시트로 그려진다(짐승·드론은 기존 스탬프) */
  await ev(() => { DG.side.leave && DG.side.leave(); });
  await sleep(500);
  await ev(() => { DG.side.enter('field'); });
  await sleep(1500);
  await ev(() => { if (DG.sideView3d.active()) { DG.sideView3d.toggle(); } var R = DG.side.raw(); R.hp = R.hpMax = 99999; R.player.invuln = 99; });
  await sleep(3000);
  const m2 = await ev(() => {
    var R = DG.side.raw(), hs = R.enemies.filter((e) => e.ref.kind === 'human'), pools = hs.map((e) => DG.mode2d.pick('t' + (e.ref.tier || 1), e.ref.name));
    return { on: DG.mode2d.isOn(), humans: hs.length, loaded: pools.filter((p) => p && DG.mode2d.loaded(p, 'walk') === true).length, failed: pools.filter((p) => p && DG.mode2d.failed(p, 'walk') === true).length };
  });
  check('2D 모드 시트 — 3D 바탕을 끄면 사람형 적이 시트로 그려진다(walk 이미지를 받아 둠, 실패 0)', m2.on && m2.humans > 0 && m2.loaded > 0 && m2.failed === 0, JSON.stringify(m2));
} catch (e) { console.log('ERR', e.message); results.push(false); }

const ext = r.errors.filter((e) => /ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e)).length;
const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
if (ext) { console.log('밖으로 나가는 요청 실패(페이지 오류 아님):', ext + '건'); }
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 5).join(' | ') : '없음');
console.log('404 주소:', r.notFound.length ? r.notFound.join(', ') : '없음');
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-st-sheet.json', JSON.stringify({ script: 'pw-st-sheet.mjs', game: 'saga-story', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, notFound: r.notFound, checks: rows }, null, 1) + '\n');
await r.close();
process.exit(0);
