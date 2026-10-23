// 첫 10분 자동 점검(W-0381) — 새 계정으로 판마다 N분을 자동으로 놀아 "처음 들어온 사람이 막히나" 를 잰다.
//   node pw-first10.mjs [판…] [--min=10] [--stuck=240] [--no-clear] [--phone] [--base http://127.0.0.1:8871/]
//   서버: --base 를 안 주면 이 스크립트가 serve.mjs 를 8871 에 띄우고 끝에 그 PID 만 끈다.
// 판마다 새 컨텍스트(새 프로필) → 새 계정 → 첫 화면 이어하기 → (5천하는 시나리오·세력 단추) → 안내 없이 그대로 논다:
//   네 판 = 판 자동 퀘스트(DG.autoQuestGo·Dg·Fs·St)를 켜 두고 15초마다 상태를 적는다(멈추면 다시 켬 — 사람이 ▶ 를 다시 누르듯)
//   5천하 = 자동 퀘스트가 없는 턴제라 15초마다 ▶ 다음 달 단추(실제 단추)
// 재는 것: 페이지 예외(pageerror) · 막힘(같은 목표 120초 넘게 · 자동이 '막힘' 으로 멈춤 · 목표 없음) · 진척(넘어간 목표 수 · 「오늘」 줄 완료 수 · 5천하는 달)
//   · 끝에 남은 가림 창(listOverlays) · 끝 화면 PNG(shots/first10/<판>.png, 커밋 안 함)
// PASS = 예외 0 · 막힘 0 · 진척 > 0. 결과: 콘솔 + results/pw-first10.json. 종료 코드 = FAIL 수.
// 판 코드는 안 고친다 — 막힘이 나오면 판별 버그 티켓으로(W-0381 불변 규칙).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { open, sleep } from './pw.mjs';
import { clearOverlays, listOverlays } from './overlay.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const MIN = +opt('min', 10);
const PHONE = argv.includes('--phone');
const bi = argv.indexOf('--base');
const ALL = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm'];
const games = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--base');
const LIST = games.length ? games : ALL;
const TICK = 15000, STUCK_SEC = +opt('stuck', 240), NO_CLEAR = argv.includes('--no-clear');   // 막힘 = 같은 목표 STUCK_SEC 초 넘게(싸움·대화 목표는 1~2분 걸린다 — 첫 실행 120 은 오탐) · --no-clear 면 루프 중엔 창을 안 닫는다(도구가 진행 창을 끊는지 가릴 때)
const AQ = { 'saga-go': 'autoQuestGo', 'saga-dungeon': 'autoQuestDg', 'saga-forest': 'autoQuestFs', 'saga-story': 'autoQuestSt' };
const SHOTS = path.join(HERE, 'shots', 'first10');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });

let server = null;
if (bi < 0 && !process.env.PW_BASE) {
  server = spawn(process.execPath, [path.join(HERE, 'serve.mjs'), path.resolve(HERE, '../..'), '8871'], { stdio: 'ignore' });
  await sleep(800);
}

/** 새 사람이 반드시 하는 고르기 — 사람처럼 첫 후보로 고르고 확인한다(가림 창으로 닫으면 부팅이 안 끝난다: 2나락 출사표 셋). 고른 게 있으면 이름 */
const choices = (page) => page.evaluate(() => {
  const vis = (e) => !!(e && e.getClientRects().length);
  const cells = [...document.querySelectorAll('.stc-cell')].filter(vis);
  if (cells.length) { cells.slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b && !b.disabled) { b.click(); return '출사표 셋'; } }
  return '';
});

/** 「오늘」 창 줄 완료 수(W-0380) — 없으면 null */
const todayDone = (page) => page.evaluate(() => { const A = window.DG && DG.goalsAdapter; if (!A) { return null; } try { const m = A.model(); return (m.today || []).concat(m.week || []).filter((r) => r.done).length; } catch (e) { return null; } });

async function runGame(game) {
  const r = await open(game, PHONE ? { w: 390, h: 844, mobile: true } : {});
  const { page } = r, rows = [], t0 = Date.now();
  const res = { game, min: MIN, device: PHONE ? 'phone' : 'pc', exc: 0, consoleErr: 0, stuck: [], steps: 0, today0: null, today1: null, turn0: null, turn1: null, overlays: [], log: [] };
  try {
    await page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(1500);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* 없음 */ } DG.account.create('첫십분'); });
    await page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(3500);
    await page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    { const ch = await choices(page); if (ch) { res.log.push('고름 ' + ch); await sleep(3000); } }
    await clearOverlays(page, game);
    if (game === 'saga-realm') {
      await page.locator('[data-act="pick-scen"]').first().click({ timeout: 10000 }); await sleep(1200);
      await page.locator('[data-act="pick-force"]').first().click({ timeout: 10000 }); await sleep(2500);
      await clearOverlays(page, game);
      res.turn0 = await page.evaluate(() => DG.rtk.state().turn);
    }
    res.today0 = await todayDone(page);
    const aqName = AQ[game];
    let lastGoal = null, lastProg = null, minDist = Infinity, goalSince = Date.now();
    const end = t0 + MIN * 60000;
    while (Date.now() < end) {
      { const ch = await choices(page); if (ch) { res.log.push('고름 ' + ch); await sleep(2000); } }
      if (!NO_CLEAR) { await clearOverlays(page, game); }
      if (aqName) {
        const s = await page.evaluate((n) => { const A = DG[n]; if (!A) { return { none: true }; } let st = A.status(); if (!st.on) { A.start(); st = A.status(); } var D = DG.dungeon, extra = D && D.active ? (D.active() ? ' [던전 ' + ((D.status && D.status().floor) || '?') + '층]' : ' [마을]') : ''; var SD = DG.story, so = SD && SD.isOpen && SD.isOpen() ? ' [이야기 창]' : ''; return { on: st.on, goal: st.goal ? (st.goal.id || st.goal.label) : null, label: st.goal ? st.goal.label : '', why: st.why, stuck: st.stuck, done: st.done, extra: extra + so + (st.doing ? ' · ' + String(st.doing).slice(0, 40) : '') }; }, aqName);
        if (s.none) { res.stuck.push('자동 퀘스트 어댑터 없음'); break; }
        res.steps = Math.max(res.steps, s.done || 0);
        const pc = (/(\d+)\/\d+/.exec((s.label || '') + ' ' + (s.extra || '')) || [])[1], dist = +((/ (\d+)보/.exec(s.extra || '') || [])[1] || NaN);
        if (s.goal === lastGoal && dist < minDist - 300) { minDist = dist; goalSince = Date.now(); }   // 목표에 300보 넘게 다가섰으면 걷는 중(첫 목표가 3천 보 밖 — W-0382), 막힘 아님
        if (s.goal !== lastGoal) { minDist = isNaN(dist) ? Infinity : dist; }   // 같은 목표라도 셈(0/10 → 2/10)이 늘면 막힘 아님(W-0382 — 토벌은 10마리에 몇 분)
        if (s.goal !== lastGoal || (pc != null && pc !== lastProg)) { if (s.goal === lastGoal) { res.progress = (res.progress || 0) + 1; } lastGoal = s.goal; lastProg = pc; goalSince = Date.now(); }
        const held = Math.round((Date.now() - goalSince) / 1000);
        res.log.push(`${Math.round((Date.now() - t0) / 1000)}s ${s.on ? '▶' : '■'} ${s.label || '-'} ${s.why || ''} 멈춤${s.stuck}${s.extra || ''}`.trim());
        if (!s.on && /막힘/.test(s.why || '')) { res.stuck.push(`자동 멈춤 '${s.why}' (${s.label || '-'})`); }
        if (!s.on && /목표 없음/.test(s.why || '')) { res.stuck.push('목표 없음 — 다음 할 일이 안 보임'); break; }
        if (held > STUCK_SEC && !res.stuck.some((x) => x.indexOf(s.label) >= 0)) { res.stuck.push(`같은 목표 ${held}초 — ${s.label}`); }
      } else {
        const t = await page.evaluate(() => { const b = document.querySelector('[data-act="next-month"]'); if (b && b.offsetParent) { b.click(); return 'click'; } return 'none'; });
        res.log.push(`${Math.round((Date.now() - t0) / 1000)}s 다음 달 ${t}`);
        if (t === 'none') { await clearOverlays(page, game); }
      }
      await sleep(TICK);
    }
    if (aqName) { await page.evaluate((n) => { if (DG[n]) { DG[n].stop(); } }, aqName); }
    if (game === 'saga-realm') { res.turn1 = await page.evaluate(() => DG.rtk.state().turn); res.steps = (res.turn1 || 0) - (res.turn0 || 0); }
    res.today1 = await todayDone(page);
    res.overlays = await listOverlays(page, game);
    await page.screenshot({ path: path.join(SHOTS, game + (PHONE ? '-phone' : '') + '.png') });
  } catch (e) { res.stuck.push('스크립트 예외 ' + e.message.slice(0, 160)); }
  res.exc = r.errors.filter((x) => x.startsWith('EXC')).length;
  res.consoleErr = r.errors.length - res.exc;
  res.excSample = r.errors.filter((x) => x.startsWith('EXC')).slice(0, 3);
  await r.close();
  const prog = res.steps > 0 || res.progress > 0 || (res.today1 || 0) > (res.today0 || 0);
  res.ok = res.exc === 0 && res.stuck.length === 0 && prog;
  res.detail = `${res.ok ? 'PASS' : 'FAIL'} 진척 ${game === 'saga-realm' ? '달 ' : '목표 '}${res.steps}${res.progress ? ' · 셈 +' + res.progress : ''} · 「오늘」 ${res.today0}→${res.today1} · 예외 ${res.exc} · 막힘 ${res.stuck.length ? res.stuck.join(' / ') : 0}` + (res.overlays.length ? ' · 남은 창 ' + res.overlays.join(',') : '');
  return res;
}

const out = [];
for (const g of LIST) {
  const r = await runGame(g);
  console.log((r.ok ? 'PASS ' : 'FAIL ') + g + ' — ' + r.detail);
  out.push(r);
}
if (server) { try { process.kill(server.pid); } catch (e) { /* 이미 꺼짐 */ } }
const pass = out.filter((r) => r.ok).length;
fs.writeFileSync(path.join(HERE, 'results', 'pw-first10.json'), JSON.stringify({ script: 'pw-first10.mjs', game: LIST.length === 5 ? 'all' : LIST.join(','), min: MIN, pass, total: out.length,
  checks: out.map((r) => ({ name: r.game + ' 첫 ' + MIN + '분', ok: r.ok, detail: r.detail, log: r.log.slice(-40), exc: r.excSample })) }, null, 1) + '\n');
console.log('요약 ' + pass + '/' + out.length);
process.exit(out.length - pass);
