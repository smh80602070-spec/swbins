// 사가국지 2D 국토 지도 꾸밈(W-0023)이 실제 주소로 받아지는지 본다 — map2d.terrain·castle 이 돌려주는 SVG 조각과 그 안의 이미지 주소
//   node pw-map2d.mjs
// 땅 종류 넷(plain·hill·mount·river)이 든 가짜 성 목록으로 terrain 을, 병력 단계 셋(1.6·2.8·3.6)으로 castle 을 불러 문자열을 만들고,
// 그 안의 href 를 전부 fetch 해 200 인지 본다. 3D 가 안 서 있는(2D) 상태에서만 문자열이 나온다. 스크린샷 없음.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const r = await open('saga-realm');
await r.page.goto(r.url('index.html')); await sleep(1500);
const out = await r.page.evaluate(async () => {
  const A = window.DG.assets3d, Mp = window.DG.map2d;
  if (!Mp) { return { error: 'DG.map2d 없음' }; }
  await new Promise((ok) => A.whenSettled(ok));
  const cities = [{ x: 0, y: 0, land: 'plain' }, { x: 20, y: 5, land: 'hill' }, { x: 40, y: 9, land: 'mount' }, { x: 60, y: 14, land: 'river' }];
  const terr = Mp.terrain(cities), rows = [1.6, 2.8, 3.6].map((rad) => Mp.castle({ x: 10, y: 10 }, rad));
  const hrefs = [];
  [terr].concat(rows).forEach((s) => { const re = /href="([^"]+)"/g; let m; while ((m = re.exec(s))) { hrefs.push(m[1]); } });
  const codes = {};
  for (const u of hrefs) { try { const rs = await fetch(u); codes[u.replace(/^.*shared\//, '')] = rs.status; } catch (e) { codes[u] = 0; } }
  return { patterns: (terr.match(/<pattern /g) || []).length, circles: (terr.match(/<circle /g) || []).length, castles: rows.filter((x) => x).length, codes };
});
console.log(JSON.stringify(out, null, 1));
const bad = [];
if (out.error) { bad.push(out.error); } else {
  if (out.patterns !== 4) { bad.push('무늬 ' + out.patterns + '(4 기대)'); }
  if (out.circles !== 4) { bad.push('번짐 원 ' + out.circles); }
  if (out.castles !== 3) { bad.push('성 그림 ' + out.castles + '(3 기대)'); }
  Object.entries(out.codes).forEach(([u, c]) => { if (c !== 200) { bad.push(u + ' → ' + c); } });
}
console.log(bad.length ? 'FAIL ' + bad.join(' · ') : 'OK 무늬 4 · 번짐 4 · 성 그림 3 · 주소 전부 200');
await r.close();
process.exit(bad.length ? 1 : 0);
