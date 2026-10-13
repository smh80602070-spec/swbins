// G-0220 — 4종횡 대사 감정 칸(웹 saga-web/saga-story/js/data-scenario.js SCENES 의 [누구, 감정, 글])을 고돗 JSON 으로 옮긴다.
//   node saga-godot/tools/story_emotes_from_web.mjs   → saga-godot/games/saga_story/data/story_emotes.json
// 고돗 scenario.gd 는 같은 대사에서 감정 칸만 뺐다 — 장면마다 [감정, 글 앞 12자] 를 줄 차례대로 둔다(글 앞이 다르면 그 줄은 감정 없음).
// 웹 파일은 읽기만 한다. 같은 입력 = 같은 출력(장면 한 줄씩). 손으로 고치지 않는다.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const src = path.join(repo, 'saga-web', 'saga-story', 'js', 'data-scenario.js');
const box = {};
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(src, 'utf8'), box, { filename: src });
const scenes = box.DG && box.DG.scenarioData && box.DG.scenarioData.SCENES;
if (!scenes) {
  console.error('SCENES 없음: ' + src);
  process.exit(1);
}
const PREFIX = 12;
const J = (o) => JSON.stringify(o);
const keys = Object.keys(scenes).sort();
const lines = ['{', ' "_from": ' + J('생성물 — node saga-godot/tools/story_emotes_from_web.mjs (웹 saga-web/saga-story/js/data-scenario.js SCENES). 손으로 고치지 않는다.') + ','];
keys.forEach((k, i) => {
  const rows = (scenes[k].lines || []).map((l) => [String(l[1] || ''), Array.from(String(l[2] || '')).slice(0, PREFIX).join('')]);
  lines.push(' ' + J(k) + ': ' + J(rows) + (i < keys.length - 1 ? ',' : ''));
});
lines.push('}');
const out = path.join(repo, 'saga-godot', 'games', 'saga_story', 'data', 'story_emotes.json');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('story_emotes.json — 장면 ' + keys.length + ' · 줄 ' + keys.reduce((n, k) => n + (scenes[k].lines || []).length, 0));
