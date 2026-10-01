// 사가고 확인 시트(tasks/sheets/saga-go-*.md) 다섯 기능을 Playwright 로 직접 해 본다.
//   node pw-go-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 새 계정으로 들어가 들판 무리 곁에서 실제 키(J·E·␣·1~4·M)와 자동 전투·지역 발견을 본다.
// **기계가 한 확인**(D2 기록)이다 — 때리는 손맛·그림은 사람 눈(D3)이 본다. 결과는 콘솔 + results/pw-go-sheet.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(ok); rows.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-go');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);

async function skipScenes() {
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
}
async function boot() {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  await skipScenes();
  await ev(() => { DG.core.setTune('world3d.dayNight', 0); });
}
/** 가장 가까운 무리 하나 곁(16m)으로 간다. 체력을 키워 시험 중에 안 죽게 하고, 무리 정보를 돌려준다 */
async function toCamp() {
  for (let k = 0; k < 8; k++) {
    const camp = await ev(() => {
      var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, best = null, bd = 1e9;
      if (!S) { return null; }
      for (var key in S.camps) { var cp = S.camps[key]; if (cp.kind === 'guard' || cp.sky) { continue; } var d = Math.hypot(cp.x - p.x, cp.y - p.y); if (d < bd) { bd = d; best = cp; } }
      if (!best) { return null; }
      var f0 = null; best.uids.forEach((u) => { var f = S.foes[u]; if (f && f.hp > 0 && (!f0 || Math.hypot(f.x - p.x, f.y - p.y) < Math.hypot(f0.x - p.x, f0.y - p.y))) { f0 = f; } });
      return { key: best.key, x: best.x, y: best.y, n: best.uids.length, fx: f0 ? f0.x : best.x, fy: f0 ? f0.y : best.y };
    });
    if (camp) {
      await ev((c) => { var p = DG.core.save.player.pos; p.x = c.fx - 2.5; p.y = c.fy; }, camp);
      await sleep(2500);
      return camp;
    }
    await ev(() => { DG.core.save.player.pos.x += 300; });
    await sleep(1500);
  }
  return null;
}
const foes = (key) => ev((k) => {
  var S = DG.fieldCombat.state(), cp = S.camps[k], hp = 0, sh = 0, alive = 0;
  if (cp) { cp.uids.forEach((u) => { var f = S.foes[u]; if (f && f.hp > 0) { alive++; hp += f.hp; sh += f.shield || 0; } }); }
  return { alive: alive, hp: Math.round(hp), shield: Math.round(sh) };
}, key);
const me = () => ev(() => { var S = DG.fieldCombat.state(), m = S.party[S.active]; return { hp: Math.round(m.hp), hpMax: m.hpMax, combo: S.combo, iframe: S.iframe, dash: !!S.dash, stamina: Math.round(S.stamina), active: S.active, partyN: S.party.length }; });

try {
  await boot();
  const camp = await toCamp();
  check('준비 — 들판에 무리가 있고 적 곁(2.5m)에 선다', !!camp, JSON.stringify(camp));
  if (camp) {
    /* 안 죽게 */
    await ev(() => { var S = DG.fieldCombat.state(); S.party.forEach((m) => { m.hp = m.hpMax = 99999; }); });

    /* 1) 실시간 전투 — J 기본기·E 스킬(돌진은 무적)·␣ 회피 */
    const f0 = await foes(camp.key), m0 = await me();
    for (let i = 0; i < 5; i++) { await page.keyboard.press('j'); await sleep(260); }
    const f1 = await foes(camp.key), m1 = await me();
    check('실시간 전투 — J 로 치면 무리의 체력·방패가 줄고 콤보가 오른다', (f1.hp + f1.shield) < (f0.hp + f0.shield) && m1.combo >= 1, '체력+방패 ' + (f0.hp + f0.shield) + '→' + (f1.hp + f1.shield) + ' · 콤보 ' + m1.combo);

    await sleep(1200);
    await page.keyboard.press('e'); await sleep(120);
    const sk = await me();
    check('실시간 전투 — E 스킬(불꽃 돌진)을 쓰면 돌진 중 무적이 선다', sk.dash || sk.iframe > 0, JSON.stringify({ dash: sk.dash, iframe: sk.iframe }));

    await sleep(1500);
    const st0 = (await me()).stamina;
    await page.keyboard.press('Space'); await sleep(100);
    const dg = await me();
    check('실시간 전투 — ␣ 회피를 누르면 무적 프레임이 서고 기력이 줄어든다', dg.iframe > 0 && dg.stamina < st0, '무적 ' + dg.iframe.toFixed(2) + ' · 기력 ' + st0 + '→' + dg.stamina);

    /* 자동 전투 — 키를 안 눌러도 무리 체력이 준다 */
    await sleep(800);
    await ev((c) => { var p = DG.core.save.player.pos; p.x = c.fx - 8; p.y = c.fy; }, camp);
    await sleep(500);
    const fa0 = await foes(camp.key);
    await ev(() => { DG.core.save.settings.autoBattle = true; });
    await sleep(9000);
    const fa1 = await foes(camp.key);
    await ev(() => { DG.core.save.settings.autoBattle = false; });
    check('실시간 전투 — 🤖 자동 전투를 켜면 키 없이도 무리 체력이 준다', (fa1.hp + fa1.shield) < (fa0.hp + fa0.shield) || fa1.alive < fa0.alive, '체력+방패 ' + (fa0.hp + fa0.shield) + '→' + (fa1.hp + fa1.shield) + ' · 살아 있는 적 ' + fa0.alive + '→' + fa1.alive);

    /* 5) 자동 순행 — 켜면 스스로 움직이고 싸운다 */
    const ap0 = await ev(() => { var p = DG.core.save.player.pos, S = DG.fieldCombat.state(); return { x: p.x, y: p.y, kills: S.kills || 0 }; });
    await ev(() => { DG.auto.setOn(true); });
    await sleep(12000);
    const ap1 = await ev(() => { var p = DG.core.save.player.pos, S = DG.fieldCombat.state(); return { x: p.x, y: p.y, kills: S.kills || 0, on: DG.auto.active() }; });
    await ev(() => { DG.auto.setOn(false); });
    const moved = Math.hypot(ap1.x - ap0.x, ap1.y - ap0.y);
    check('자동 순행 — 켜면 스스로 걸어 다니며 싸운다', ap1.on && (moved > 3 || ap1.kills > ap0.kills), '켜짐 ' + ap1.on + ' · 이동 ' + moved.toFixed(1) + 'm · 처치 ' + ap0.kills + '→' + ap1.kills);

    /* 2) 들판 전투 — 방패(원소)·동행 교체 */
    const fb = await ev((k) => { var S = DG.fieldCombat.state(), cp = S.camps[k], out = []; if (cp) { cp.uids.forEach((u) => { var f = S.foes[u]; if (f) { out.push({ n: f.name, el: f.el, shMax: f.shieldMax, sh: Math.round(f.shield || 0), hp: Math.round(f.hp) }); } }); } return out; }, camp.key);
    check('들판 전투 — 적마다 이름·체력·원소 방패 줄이 있다', fb.length > 0 && fb.every((f) => f.n && f.shMax >= 0), JSON.stringify(fb.slice(0, 2)));
    const pm = await me();
    if (pm.partyN >= 2) {
      await page.keyboard.press('2'); await sleep(400);
      const after = await me();
      check('들판 전투 — 숫자 2 로 동행을 바꾸면 조작 인물이 바뀐다', after.active !== pm.active, pm.active + '→' + after.active);
    } else {
      console.log('SKIP 들판 전투 — 동행 교체: 새 계정은 편성이 1명(' + pm.partyN + ')이라 못 잰다');
    }
  }

  /* 3) 지역 발견 */
  const lm = await ev(() => { var B = DG.biome, p = DG.core.save.player.pos, arr = B.landmarks(p.x, p.y, 1500); var t = arr.find((l) => !B.found(l.key)); return t ? { key: t.key, x: t.x, y: t.y, name: t.name } : { none: true, n: arr.length }; });
  if (lm && lm.key) {
    await ev((l) => { var p = DG.core.save.player.pos; p.x = l.x; p.y = l.y; }, lm);
    await sleep(2500);
    const found = await ev((k) => DG.biome.found(k), lm.key);
    check('지역 지도 — 지역 랜드마크에 닿으면 지역이 발견된다', found, JSON.stringify(lm));
    /* 4) 전체지도(M) — 열고 닫고, 발견한 지점으로 순간이동 */
    await page.keyboard.press('m'); await sleep(600);
    const op = await ev(() => DG.overworld.opened);
    await page.keyboard.press('m'); await sleep(400);
    const cl = await ev(() => DG.overworld.opened);
    check('발견 도감·전체지도 — M 으로 전체지도가 열리고 다시 M 으로 닫힌다', op === true && cl === false, '열림 ' + op + ' · 닫힘 ' + !cl);
    const way = await ev(() => { var w = DG.biome.waypoints(); return Array.isArray(w) ? w.length : Object.keys(w || {}).length; });
    check('발견 도감·전체지도 — 발견한 지점이 순간이동 지점으로 열린다', way >= 1, '지점 ' + way);
  } else {
    check('지역 지도 — 아직 발견 안 한 랜드마크를 찾는다', false, JSON.stringify(lm));
  }
} catch (e) { console.log('ERR', e.message); results.push(false); }

const ext = r.errors.filter((e) => /ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e)).length;
const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
if (ext) { console.log('밖으로 나가는 요청 실패(지도 타일 등, 페이지 오류 아님):', ext + '건'); }
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 5).join(' | ') : '없음');
console.log('404 주소:', r.notFound.length ? r.notFound.join(', ') : '없음');
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-sheet.json', JSON.stringify({ script: 'pw-go-sheet.mjs', game: 'saga-go', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, notFound: r.notFound, checks: rows }, null, 1) + '\n');
await r.close();
process.exit(0);
