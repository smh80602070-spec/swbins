// 촬영 전 가리는 창 닫기 — 공용(W-0317 ⑦). 스크립트마다 따로 있던 clearIntro(pw-phone-budget·pw-gfx·pw-deploy·pw-play·pose-games·pw-look2d·pw-visual-close)를 하나로.
//   listOverlays(page, game, opt)  → 지금 열린 가리는 창 이름 목록(['scenario', 'menu', …])
//   clearOverlays(page, game, opt) → 닫고 남은 목록을 돌려준다(빈 배열 = 깨끗)
//   beforeShot(page, game, opt)    → 닫기 → 남으면 opt.wait(600ms) 쉬고 한 번 더(FAIL 아님) → 그래도 남은 목록 = 결과 json 의 covered
//
// 닫는 법은 **게임에 이미 있는 DG 함수·단추만** 쓴다(게임 코드는 안 건드린다). Esc 키는 안 쓴다 — 4종횡은 Esc 가 ☰ 메뉴를 열고(qc-gaps #7),
// 다른 판도 Esc 가 창 하나씩만 닫아 차례에 따라 결과가 갈렸다.
//
// 판별 차이(표):
//   | 판        | encounter(#encounter.show)                                   |
//   | 1만리     | 만남 카드 — 닫기 단추(닫기·물러난다·나중에·✕), 없으면 show 를 뗀다 |
//   | 5천하     | 시나리오·세력 고르기를 같은 자리에 띄운다 → 닫지 않는다(닫으면 빈 화면) |
//   | 나머지 셋 | 열려 있으면 목록에만 남긴다(전투 화면일 수 있다 — opt.encounter=true 면 닫는다) |
// opt.keep: 닫지 않을 이름 목록(일부러 연 창을 찍을 때 — 예: ['sheet'] 로 성 시트 촬영)

/** 페이지 안에서 — 열린 가리는 창 이름들. 순수 DOM·DG 읽기만 */
function probe(game) {
  const D = window.DG || {}, vis = (el) => !!(el && el.offsetParent !== null), out = [];
  if (D.scenario && D.scenario.isOpen && D.scenario.isOpen()) { out.push('scenario'); }
  if (D.story && D.story.isOpen && D.story.isOpen()) { out.push('story'); }
  if ([...document.querySelectorAll('button, [data-act="story-skip"]')].some((b) => vis(b) && (/건너뛰기/.test(b.textContent) || b.getAttribute('data-act') === 'story-skip'))) { out.push('skip-button'); }
  if (vis(document.getElementById('help-ok'))) { out.push('help'); }
  if ((D.menuGrid && D.menuGrid.isOpen && D.menuGrid.isOpen()) || document.querySelector('#menu-grid.show')) { out.push('menu'); }
  if (D.passiveWebUI && D.passiveWebUI.isOpen && D.passiveWebUI.isOpen()) { out.push('passive'); }
  if (D.minimap && D.minimap.isBig && D.minimap.isBig()) { out.push('bigmap'); }
  if (document.querySelector('#top-more.show, #tools-drawer.show')) { out.push('drawer'); }
  if (document.querySelector('#sheet.show')) { out.push('sheet'); }
  if (document.querySelector('#detail.show')) { out.push('detail'); }
  const enc = document.querySelector('#encounter.show');
  if (enc && !(game === 'saga-realm' && enc.querySelector('[data-act^="pick-"]'))) { out.push('encounter'); }
  return out;
}

/** 페이지 안에서 — 이름 하나 닫기(이미 있는 함수·단추만) */
function closeOne([name, game]) {
  const D = window.DG || {}, vis = (el) => !!(el && el.offsetParent !== null);
  const clickText = (root, re) => { const b = [...root.querySelectorAll('button')].find((x) => vis(x) && re.test(x.textContent)); if (b) { b.click(); return true; } return false; };
  switch (name) {
    case 'scenario': if (D.scenario && D.scenario.skip) { D.scenario.skip(); } break;
    case 'story': if (D.story && D.story.skip) { D.story.skip(); } break;
    case 'skip-button': document.querySelectorAll('button, [data-act="story-skip"]').forEach((b) => { if (vis(b) && (/건너뛰기/.test(b.textContent) || b.getAttribute('data-act') === 'story-skip')) { b.click(); } }); break;
    case 'help': { const h = document.getElementById('help-ok'); if (h) { h.click(); } break; }
    case 'menu': if (D.menuGrid && D.menuGrid.close) { D.menuGrid.close(); } else { const m = document.getElementById('menu-grid'); if (m) { m.classList.remove('show'); } } break;
    case 'passive': if (D.passiveWebUI && D.passiveWebUI.close) { D.passiveWebUI.close(); } break;
    case 'bigmap': if (D.minimap && D.minimap.closeBig) { D.minimap.closeBig(); } break;
    case 'drawer': document.querySelectorAll('#top-more.show, #tools-drawer.show').forEach((e) => e.classList.remove('show')); break;
    case 'sheet': { const s = document.querySelector('#sheet.show'); if (s && !clickText(s, /닫기|✕|돌아가기/)) { s.classList.remove('show'); } break; }
    case 'detail': { const s = document.querySelector('#detail.show'); if (s && !clickText(s, /닫기|✕|돌아가기/)) { s.classList.remove('show'); } break; }
    case 'encounter': { const e = document.querySelector('#encounter.show'); if (e && !clickText(e, /닫기|물러난다|나중에|✕/)) { e.classList.remove('show'); } break; }
    default: break;
  }
  return game;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 지금 열린 가리는 창 이름 목록 */
export async function listOverlays(page, game) {
  try { return await page.evaluate(probe, game || ''); } catch (e) { return ['probe-error:' + String(e.message).slice(0, 60)]; }
}

/** 닫기 — 이야기·대화는 한 장씩 넘겨야 해서 최대 opt.rounds(14) 번 돈다. 남은 목록을 돌려준다 */
export async function clearOverlays(page, game, opt = {}) {
  const keep = new Set(opt.keep || []), rounds = opt.rounds || 14;
  const skipEnc = !(game === 'saga-go' || opt.encounter);   // 1만리 만남 카드만 기본으로 닫는다(표)
  let left = [];
  for (let i = 0; i < rounds; i++) {
    left = (await listOverlays(page, game)).filter((n) => !keep.has(n) && !(skipEnc && n === 'encounter'));
    if (!left.length) { break; }
    for (const n of left) { try { await page.evaluate(closeOne, [n, game || '']); } catch (e) { /* 다음 바퀴 */ } }
    await sleep(250);
  }
  return (await listOverlays(page, game)).filter((n) => !keep.has(n));
}

/** 촬영 직전 — 닫기 → 남으면 한 번 더(늦게 뜨는 서막 대화) → 남은 것 = covered(결과 json 에 그대로 적는다) */
export async function beforeShot(page, game, opt = {}) {
  let left = await clearOverlays(page, game, opt);
  if (left.length) { await sleep(opt.wait || 600); left = await clearOverlays(page, game, opt); }
  return left;
}
