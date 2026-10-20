// W-0339 판별 보정 계산 — results/pw-look.json(지금 보정을 켠 채 잰 값) → shared/js/look3d.js 의 CAL 표를 고쳐 쓴다.
//   node look-calibrate.mjs [--target 0.10] [--alpha 0.5]   뒤에 sync-shared·bundle·pw-look-compare 로 다시 잰다(두세 번이면 맞는다)
// 노출: 새 = 지금 × (목표 Y / 잰 Y)^0.9 — 0.5~4 안. 색: 판 평균색(합 1)을 다섯 판 중앙색 쪽으로 alpha 만큼(기본 절반) 당기는 곱 —
//   0.7~1.6 안, 휘도(0.2126·0.7152·0.0722)가 1 이 되게 다시 나눈다(색만 바꾸고 밝기는 노출이 맡게)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOOK = path.join(HERE, '..', '..', 'shared', 'js', 'look3d.js');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const TARGET = opt('--target', 0.10), ALPHA = opt('--alpha', 0.5);
const J = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'pw-look.json'), 'utf8'));
const runs = J.runs.filter((r) => r.stats && r.look);
if (runs.length !== 5) { console.log('다섯 판 다 잰 결과가 아니다(' + runs.length + ') — 다시 재라'); process.exit(1); }
const norm = (r) => { const s = r.r + r.g + r.b || 1; return [r.r / s, r.g / s, r.b / s]; };
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const cs = runs.map((r) => norm(r.stats)), tc0 = [0, 1, 2].map((i) => med(cs.map((c) => c[i]))), ts = tc0[0] + tc0[1] + tc0[2], tc = tc0.map((v) => v / ts);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let src = fs.readFileSync(LOOK, 'utf8');
for (const r of runs) {
  const cur = r.look.cal, c = norm(r.stats);
  /* 지금 걸린 wb 를 떼고 본 바탕색 → 목표 쪽으로 alpha 만큼 */
  const raw = c.map((v, i) => v / (cur.wb[i] || 1)), rs = raw[0] + raw[1] + raw[2]; for (let i = 0; i < 3; i++) { raw[i] /= rs; }
  let wb = raw.map((v, i) => clamp(Math.pow(tc[i] / v, ALPHA), 0.7, 1.6));
  const lum = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2]; wb = wb.map((v) => +(v / lum).toFixed(3));
  const lookExp = r.look.cal.exposure / (r.look.on ? 1 : 1);
  const exp = +clamp(lookExp * Math.pow(TARGET / Math.max(0.001, r.stats.Y), 0.9), 0.5, 4).toFixed(3);
  const re = new RegExp("('" + r.game + "': \\{ exposure: )[0-9.]+(, wb: \\[)[0-9., ]+(\\] \\})");
  if (!re.test(src)) { console.log('CAL 줄 못 찾음', r.game); process.exit(1); }
  src = src.replace(re, '$1' + exp + '$2' + wb.join(', ') + '$3');
  console.log(r.game.padEnd(13), 'Y', r.stats.Y.toFixed(3), r.stats.K + 'K', '→ 노출', cur.exposure, '→', exp, '· wb', cur.wb.join('/'), '→', wb.join('/'));
}
fs.writeFileSync(LOOK, src);
console.log('목표 Y', TARGET, '· 중앙색', tc.map((v) => v.toFixed(3)).join('/'), '· alpha', ALPHA);
