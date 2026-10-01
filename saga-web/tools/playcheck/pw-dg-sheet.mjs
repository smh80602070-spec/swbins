// 사가블로 확인 시트(tasks/sheets/saga-dungeon-*.md) 다섯 기능을 Playwright 로 직접 해 본다.
//   node pw-dg-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 어드민 "⚔️ 명품 한 벌 갖춘 판" 프리셋(시트와 같음)부터 굴혈에 들어가 실제 키(Shift·␣·G)와 전투 상태를 본다.
// **기계가 한 확인**(D2 기록)이다 — 손맛·화면은 사람 눈(D3)이 본다. 결과는 콘솔 + results/pw-dg-sheet.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(ok); rows.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-dungeon');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);

/** 이야기 장면이 떠 있으면 Esc 로 넘긴다(장면 동안은 키를 장면이 먹는다) */
async function skipScenes() {
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
}
async function boot(fresh) {
  await page.goto(r.url('index.html')); await sleep(1500);
  if (fresh) { await ev(() => { DG.account.create('확인'); }); }
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await skipScenes();
}
async function preset(title) {
  await page.goto(r.url('_admin.html')); await sleep(2000);
  await page.locator('[data-tab="preset"]').click(); await sleep(300);
  const btn = page.locator('#presets .preset', { hasText: title });
  if (await btn.count() !== 1) { throw new Error('프리셋 없음 ' + title); }
  await btn.click(); await sleep(600);
  await boot(false);
}
/** 굴혈에 들어가 첫 방이 열릴 때까지 */
async function enter() {
  /* 화면의 '일반 던전 · 제1층부터' 단추(ui.js gate-normal)와 같은 순서 — 마을을 떠나고 들어가야 던전 화면(키 입력)이 선다 */
  const ok = await ev(() => { if (DG.town) { DG.town.leave(); } return DG.dungeon.enter({ floor: 1 }); });
  await sleep(1500);
  await skipScenes();
  return ok !== false && await ev(() => DG.dungeon.active());
}
const run = (fn, arg) => ev(fn, arg);

try {
  await boot(true);
  await preset('⚔️ 명품 한 벌 갖춘 판');
  const party = await ev(() => DG.core.save.party.length);
  check('준비 — 프리셋 뒤 부대가 있고 굴혈에 들어간다', party >= 1 && await enter(), '부대 ' + party);

  /* 1) 강공격·회피 */
  const near = async (dist) => run((d) => {
    var R = DG.dungeon.raw(), p = R.player, best = null;
    R.room.enemies.forEach((e) => { if (!e.dead && e.hp > 0 && (!best || Math.hypot(e.x - p.x, e.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y))) { best = e; } });
    if (!best) { return null; }
    p.x = best.x - d; p.y = best.y;
    best.hp = best.hpMax = 99999;   // 시험용 — 동행·자동 공격이 첫 방 적(체력 13)을 순식간에 치워 사거리 안에 아무도 안 남는다
    return { hp: best.hp, id: best.id || best.key || best.ref, x: Math.round(best.x), y: Math.round(best.y) };
  }, dist);
  const en0 = await near(30);
  check('준비 — 첫 방에 적이 있다', !!en0, JSON.stringify(en0));
  if (en0) {
    const heavyBefore = await ev(() => ({ cd: DG.dungeon.raw().player.heavyCd }));
    await page.keyboard.down('Shift'); await page.keyboard.up('Shift'); await sleep(300);
    const heavy = await ev(() => ({ cd: DG.dungeon.raw().player.heavyCd, cdMax: DG.dungeon.status ? 1.3 : null }));
    check('강공격 — Shift 를 누르면 강공격이 나가고 쿨다운(≈1.3초)이 돈다', heavyBefore.cd <= 0 && heavy.cd > 0.5, '쿨 ' + heavyBefore.cd + '→' + heavy.cd.toFixed(2));

    await sleep(1500);
    await page.keyboard.press('Space'); await sleep(40);
    const dg = await ev(() => { var p = DG.dungeon.raw().player; return { dodge: p.dodge ? p.dodge.t : null, cd: p.dodgeCd }; });
    check('회피 — ␣ 를 누르면 회피 동작(≈0.22초)이 서고 쿨다운이 돈다', dg.dodge !== null && dg.dodge > 0 && dg.dodge <= 0.3 && dg.cd > 0, JSON.stringify(dg));
    await sleep(1200);
    const inv = await ev(() => {
      var R = DG.dungeon.raw(), p = R.player; p.dodgeCd = 0; p.dodge = null; p.invuln = 0;
      var h0 = R.hp; DG.dungeon.doDodge(); DG.dungeon._hurt(40); var h1 = R.hp;
      return { h0: h0, h1: h1, invuln: p.invuln, dodge: !!p.dodge };
    });
    check('회피 — 회피 중 맞아도 피해가 안 들어온다(무적)', inv.dodge && inv.h1 === inv.h0, JSON.stringify(inv));
  }

  /* 2) 손맛(콤보·타격 정지) — 적 곁에서 몇 초 싸우며 관찰 */
  await run(() => { var R = DG.dungeon.raw(); R.hp = R.hpMax; R.player.invuln = 99; });
  const en1 = await near(28);
  const feel = await ev(() => new Promise((res) => {
    var R = DG.dungeon.raw(), maxC = 0, stop = 0, t0 = Date.now(), n = 0;
    var iv = setInterval(() => {
      var r = DG.dungeon.raw(); if (!r) { return; }
      n++; if (r.combo > maxC) { maxC = r.combo; } if (r.hitstopT > 0) { stop++; }
      if (Date.now() - t0 > 6000) { clearInterval(iv); res({ maxCombo: maxC, hitstopFrames: stop, samples: n, kills: r.room.enemies.filter((e) => e.dead || e.hp <= 0).length }); }
    }, 30);
  }));
  check('손맛 — 적 곁에서 싸우면 콤보가 쌓이고 타격 정지(hitstop)가 걸린다', feel.maxCombo >= 3 && feel.hitstopFrames > 0, JSON.stringify(feel));

  /* 3) 어그로 — 자는 적은 가까이(230 안) 가야 깬다 */
  await ev(() => { DG.dungeon.leave(); });
  await sleep(500);
  const ent2 = await enter();
  const far = await ev(() => {
    var R = DG.dungeon.raw(), p = R.player;
    var e = R.room.enemies.find((e) => !e.dead && e.hp > 0 && !e.aggro && !e.ranged && !e.boss);
    if (!e) { return null; }
    p.invuln = 99; p.x = e.x - 330; p.y = e.y; return { before: e.aggro, ref: e.ref || e.key || e.id };
  });
  if (far) {
    await sleep(700);
    const a1 = await ev(() => { var e = DG.dungeon.raw().room.enemies.find((e) => !e.dead && e.hp > 0 && !e.boss && !e.ranged); return e ? e.aggro : null; });
    await ev(() => { var R = DG.dungeon.raw(), p = R.player; var e = R.room.enemies.filter((e) => !e.dead && e.hp > 0 && !e.aggro && !e.ranged && !e.boss)[0]; if (e) { p.x = e.x - 190; p.y = e.y; } });
    await sleep(700);
    const a2 = await ev(() => { var R = DG.dungeon.raw(); return R.room.enemies.some((e) => !e.dead && e.hp > 0 && e.aggro); });
    check('어그로 — 멀리(330)선 안 깨고 가까이(190) 가면 깬다', a1 === false && a2 === true, '멀리 ' + a1 + ' · 가까이 ' + a2);
  } else { check('어그로 — 자는 적을 찾는다', false, 'ent2 ' + ent2); }

  /* 4) 동행 */
  const comp = await ev(() => { var R = DG.dungeon.raw(); return R ? { has: !!R.companion, id: R.companion && R.companion.id, mul: DG.dungeon._companionMul() } : null; });
  check('동행 — 부대 2번째 인물이 따라붙고 때림 배율(0.1~1.0)이 있다', comp && comp.has && comp.mul > 0.05 && comp.mul < 1.2, JSON.stringify(comp));
  const c0 = await ev(() => { var R = DG.dungeon.raw(); return { x: R.companion.x, y: R.companion.y, px: R.player.x }; });
  await ev(() => { var R = DG.dungeon.raw(); R.player.x += 160; });
  await sleep(1500);
  const c1 = await ev(() => { var R = DG.dungeon.raw(); return { x: R.companion.x, d: Math.abs(R.companion.x - R.player.x) }; });
  check('동행 — 내가 움직이면 동행이 따라온다', c1.d < Math.abs(c0.x - (c0.px + 160)) + 1, '간격 ' + Math.round(Math.abs(c0.x - (c0.px + 160))) + '→' + Math.round(c1.d));

  /* 5) 서명 무예(G) */
  const sg = await ev(() => { var R = DG.dungeon.raw(); return { mp: R.mp, cd: R.player.sigSkCd }; });
  await page.keyboard.press('g'); await sleep(300);
  const sg2 = await ev(() => { var R = DG.dungeon.raw(); return { mp: R.mp, cd: R.player.sigSkCd }; });
  check('서명 무예 — G 를 누르면 나가고 MP 는 안 쓰며 쿨다운만 돈다', sg2.cd > 0 && sg2.mp >= sg.mp - 0.01, JSON.stringify({ 전: sg, 후: sg2 }));
} catch (e) { console.log('ERR', e.message); results.push(false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e));
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 5).join(' | ') : '없음');
console.log('404 주소:', r.notFound.length ? r.notFound.join(', ') : '없음');
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-sheet.json', JSON.stringify({ script: 'pw-dg-sheet.mjs', game: 'saga-dungeon', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, notFound: r.notFound, checks: rows }, null, 1) + '\n');
await r.close();
process.exit(0);
