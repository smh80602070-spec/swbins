// 2D 전후 비교판(W-0347) — 같은 장면을 손잡이 둘(옛·새)로 pw-look2d 에 찍고, 가운데를 잘라 좌(옛)·우(새) 한 장으로 붙인다.
//   node pw-2d-cmp.mjs [판:장면 …] [--old=mode2d.mip=0] [--new=mode2d.mip=1] [--tag=w347]
//   예) node pw-2d-cmp.mjs saga-go:map saga-dungeon:town     (없으면 다섯 판 대표 장면 다섯)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 결과 shots/cmp/<tag>_<판>_<장면>.png — Claude 가 Read 로 본다(git 무시).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { open } from './pw.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OLD = opt('old', 'mode2d.mip=0'), NEW = opt('new', 'mode2d.mip=1'), TAG = opt('tag', 'cmp');
const DEF = ['saga-go:map', 'saga-dungeon:town', 'saga-forest:village', 'saga-story:field', 'saga-realm:map'];
const list = argv.filter((x) => !x.startsWith('--'));
const scenes = (list.length ? list : DEF).map((x) => x.split(':'));
const OUT = path.join(HERE, 'shots', 'cmp'); fs.mkdirSync(OUT, { recursive: true });

function shot(game, scene, tune, dest) {
  try { execFileSync('node', ['pw-look2d.mjs', game, dest, scene], { cwd: HERE, encoding: 'utf8', timeout: 150000, env: Object.assign({}, process.env, { LOOK_TUNE: tune }) }); } catch (e) { return false; }
  return fs.existsSync(dest);
}

const done = [];
for (const [game, scene] of scenes) {
  const a = path.join(OUT, '_' + game + '_' + scene + '_old.png'), b = path.join(OUT, '_' + game + '_' + scene + '_new.png');
  if (!shot(game, scene, OLD, a) || !shot(game, scene, NEW, b)) { console.log('FAIL', game, scene, '촬영 못 함'); continue; }
  const dest = path.join(OUT, TAG + '_' + game + '_' + scene + '.png');
  const r = await open(game, { w: 1300, h: 760 });
  try {
    const src = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    /* 1280×720 의 가운데 640×720 을 좌우로 — 같은 자리 비교가 요점이라 확대 없이 원래 화소 */
    await r.page.setContent('<body style="margin:0;background:#111;color:#ddd;font:14px sans-serif"><div style="display:flex;gap:10px;padding:6px">' +
      ['옛 ' + OLD, '새 ' + NEW].map((t, i) => '<div><div>' + t + '</div><div style="width:640px;height:720px;overflow:hidden"><img src="' + src(i ? b : a) + '" style="margin-left:-320px"></div></div>').join('') + '</div></body>');
    await r.page.waitForTimeout(300);
    await r.page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 1300, height: 752 } });
  } finally { await r.close(); }
  fs.rmSync(a, { force: true }); fs.rmSync(b, { force: true });
  done.push(dest); console.log('OK', dest);
}
console.log('CMP ' + done.length + '/' + scenes.length);
