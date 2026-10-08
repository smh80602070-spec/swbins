// 다섯 판 2D 모드 기계 확인(W-0069, W-0106 장면 14 — 판마다 2~3) — pw-look2d.mjs 를 판마다 돌려 2D 장면이 예외 없이 그려지는지(그림 파일이 비지 않았나)를 남긴다.
//   node pw-web-2d-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// **기계가 한 확인**(D2 기록)이다 — 그림이 어울리는지·크기는 사람 눈(D3). 결과는 콘솔 + results/pw-web-2d-sheet.json (그림은 shots/ — git 이 무시)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SCENES = [['saga-go', 'map', 'W-0019·0022 사가만리 2D 캔버스 판(역참·집·인물)'], ['saga-go', 'near', 'W-0106 사가만리 2D 가까이(휠)'], ['saga-go', 'enc', 'W-0106 사가만리 2D 조우 카드'],
  ['saga-forest', 'village', 'W-0019 사가마을 2D 마을'], ['saga-forest', 'home', 'W-0106 사가마을 2D 집 안'], ['saga-forest', 'night', 'W-0106 사가마을 2D 밤'],
  ['saga-dungeon', 'town', 'W-0024·0045 사가나락 2D 마을(건물)'], ['saga-dungeon', 'room', 'W-0106 사가나락 2D 던전 1층 방'], ['saga-dungeon', 'deep', 'W-0106 사가나락 2D 12층'],
  ['saga-story', 'field', 'W-0019 사가종횡 2D 사냥터'], ['saga-story', 'cave', 'W-0106 사가종횡 2D 동굴'], ['saga-story', 'gorge', 'W-0106 사가종횡 2D 협곡'],
  ['saga-realm', 'map', 'W-0023 사가천하 2D 지도(지형 바닥·성 그림)'], ['saga-realm', 'near', 'W-0106 사가천하 2D 지도 확대']];
fs.mkdirSync('shots', { recursive: true });
const rows = [];
for (const [game, scene, label] of SCENES) {
  const dest = `shots/web2d_${game}_${scene}.jpg`;
  let out = '', ok = false, detail = '';
  try { out = execFileSync('node', ['pw-look2d.mjs', game, dest, scene], { encoding: 'utf8', timeout: 150000 }); } catch (e) { out = String(e.stdout || '') + String(e.message || ''); }
  const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  const errs = (out.match(/errors (\[.*\])/) || [, '[]'])[1];
  const bad = JSON.parse(errs).filter((x) => !/status of 404/.test(x) && !/WebGL|Shader|GL_/i.test(x) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(x));   // 지도 타일(OSM) 네트워크는 판 탓이 아니다
  ok = size > 30000 && bad.length === 0;   // 빈·검은 화면의 JPEG 는 수 KB — 그림이 차 있으면 수십~수백 KB(집 안·조우 카드는 단색 면이 많아 30~50KB)
  detail = `${size}B` + (bad.length ? ' · 예외 ' + bad.slice(0, 2).join(' | ') : '');
  rows.push({ name: `${label} — 2D 로 들어가 한 장 찍힌다(빈 화면 아님, 예외 없음)`, ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + label + ' — ' + detail);
}
const pass = rows.filter((x) => x.ok).length;
console.log('요약', pass + '/' + rows.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-web-2d-sheet.json', JSON.stringify({ script: 'pw-web-2d-sheet.mjs', game: 'all', pass, total: rows.length, checks: rows }, null, 1) + '\n');
process.exit(pass === rows.length ? 0 : 1);
