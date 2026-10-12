// G-0213 — 웹 패시브 그물 정의(saga-web/<판>/js/data-passive.js, 웹 생성기 W-0179 가 쓴 것)를 고돗 JSON 으로 옮긴다.
//   node saga-godot/tools/passive_from_web.mjs saga-story   → saga-godot/games/saga_story/data/passive_def.json
// 웹 파일은 읽기만 한다. 같은 입력 = 같은 출력(마디·간선 한 줄씩 — 차이가 줄 단위로 보이게). 손으로 고치지 않는다.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const web = process.argv[2];
if (!web || !/^saga-[a-z]+$/.test(web)) {
  console.error('쓰는 법: node saga-godot/tools/passive_from_web.mjs <saga-story 같은 웹 판 폴더>');
  process.exit(2);
}
const src = path.join(repo, 'saga-web', web, 'js', 'data-passive.js');
const box = {};
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(src, 'utf8'), box, { filename: src });
const def = box.DG && box.DG.passiveDef;
if (!def || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) {
  console.error('정의 없음: ' + src);
  process.exit(1);
}
const game = web.replace('-', '_');
const out = path.join(repo, 'saga-godot', 'games', game, 'data', 'passive_def.json');
const J = (o) => JSON.stringify(o);
const lines = [];
lines.push('{');
lines.push(' "_from": ' + J(`생성물 — node saga-godot/tools/passive_from_web.mjs ${web} (웹 saga-web/${web}/js/data-passive.js). 손으로 고치지 않는다.`) + ',');
lines.push(' "v": ' + J(def.v) + ', "seed": ' + J(def.seed) + ',');
lines.push(' "starts": [');
def.starts.forEach((s, i) => lines.push('  ' + J(s) + (i < def.starts.length - 1 ? ',' : '')));
lines.push(' ],');
lines.push(' "nodes": [');
def.nodes.forEach((n, i) => lines.push('  ' + J(n) + (i < def.nodes.length - 1 ? ',' : '')));
lines.push(' ],');
lines.push(' "edges": [');
def.edges.forEach((e, i) => lines.push('  ' + J(e) + (i < def.edges.length - 1 ? ',' : '')));
lines.push(' ]');
lines.push('}');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
const cnt = (k) => def.nodes.filter((n) => n.k === k).length;
console.log(`PASSIVE_FROM_WEB ${web} → ${path.relative(repo, out).split(path.sep).join('/')} · 마디 ${def.nodes.length}(작은 ${cnt('s')}·이름난 ${cnt('n')}·규칙 ${cnt('k')}·시작점 ${cnt('o')}) · 간선 ${def.edges.length}`);
