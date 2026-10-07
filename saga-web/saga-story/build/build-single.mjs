/**
 * 단독 실행판 만들기 — 집 PC 에서 파일 하나로 그냥 열어 노는 판.
 * ---------------------------------------------------------------
 * 왜 필요한가: 이 게임은 원래 로컬 서버(8791)를 띄워 놓고 브라우저로 붙는다.
 * 집 PC 에는 파이썬도 노드도 없을 수 있고, 있어도 매번 서버를 띄우는 건 번거롭다.
 * 그래서 css/js 를 전부 한 파일에 녹여 **더블클릭으로 열리는 html** 을 만든다.
 *
 * file:// 에서 실제로 되는지 확인한 것들
 *   세이브    localStorage 는 file:// 에서도 된다 (그 PC 안에만 남는다)
 *   지도      실제 지도 타일은 인터넷이 되면 그대로 받아 온다. 못 받으면
 *             프로시저럴 지형으로 자동 폴백한다 (world.js tilesUsable)
 *   초상화    sprite 는 자기 캔버스만 toDataURL 하므로 오염(taint) 문제가 없다
 *   서비스워커 file:// 에서는 등록하지 않는다 (index.html 이 이미 막아 둔다)
 *   GPS       보안 컨텍스트가 아니라 못 쓴다 → 키보드 이동 + 🤖 자동 순행으로 논다
 *
 * 정본은 saga-web/shared/build/build-single.mjs — 판별 build/ 는 tools/sync-shared.mjs 가 복사한 사본이다(직접 고치지 않는다).
 *
 * 쓰는 법:  node build/build-single.mjs      (또는 build-pc.bat 더블클릭)
 * 결과   :  dist/<게임이름>.html  ·  dist/play.bat  ·  dist/사용법.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');
const DIST = path.join(SRC, 'dist');
/** 결과 파일 이름 — 게임마다 다르다 (다섯 판을 한 폴더에 모아도 안 겹친다) */
const NAMES = { 'saga-go': '사가만리', 'saga-dungeon': '사가나락', 'saga-forest': '사가마을', 'saga-story': '사가종횡', 'saga-realm': '사가천하' };
const GAME = NAMES[path.basename(SRC)];
if (!GAME) { throw new Error('모르는 판 폴더: ' + path.basename(SRC) + ' (shared/build/build-single.mjs 의 NAMES 에 넣을 것)'); }
const OUT_NAME = GAME + '.html';

const indexHtml = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

/* index.html 이 부르는 순서를 그대로 쓴다 — 순서를 여기서 다시 적으면
   스크립트를 하나 늘릴 때 두 곳을 고쳐야 하므로, html 에서 뽑아 쓴다. */
const scriptSrcs = [...indexHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((src) => !/^assets\/(portraits|sprites2d)\//.test(src));   // 구운 초상·몬스터 시트(assets/portraits·sprites2d)는 단독 파일에 안 들어간다
const cssHrefs = [...indexHtml.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);

if (!scriptSrcs.length) { throw new Error('index.html 에서 <script src> 를 못 찾았습니다'); }

const readAll = (list) => list.map((rel) => {
  const p = path.join(SRC, rel);
  if (!fs.existsSync(p)) { throw new Error('없는 파일: ' + rel); }
  return { rel, code: fs.readFileSync(p, 'utf8') };
});

const cssParts = readAll(cssHrefs);
const jsParts = readAll(scriptSrcs);

let html = indexHtml.replace(/<script src="assets\/(?:portraits|sprites2d)\/[^"]*manifest\.js"><\/script>\s*/g, '');   // 없는 파일을 가리키면 깨진 그림이 뜬다

/* 스타일시트 → <style> */
for (const href of cssHrefs) {
  html = html.replace(`<link rel="stylesheet" href="${href}">`, '');
}
/* 스크립트 → 인라인 */
for (const rel of scriptSrcs) {
  html = html.replace(`<script src="${rel}"></script>`, '');
}
/* 매니페스트·아이콘·서비스워커는 단독판에서 의미가 없다 (파일 하나로 다니므로) */
html = html.replace(/\s*<link rel="manifest"[^>]*>/g, '');
html = html.replace(/\s*<link rel="icon"[^>]*>/g, '');
html = html.replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '');

const styleBlock = '<style>\n' + cssParts.map((c) => `/* ==== ${c.rel} ==== */\n${c.code}`).join('\n') + '\n</style>';
const scriptBlock = jsParts.map((j) => `<script>\n/* ==== ${j.rel} ==== */\n${j.code}\n</script>`).join('\n');

/* 치환값은 반드시 **함수**로 넘긴다 — 문자열로 넘기면 코드 안의 $' (사관 시트의
   달러 표시)이 replace 의 특수 패턴으로 먹혀서 그 자리에 문서 뒷부분이 끼어든다.
   실제로 그렇게 깨져서 단독판이 SyntaxError 로 죽었다. */
html = html.replace('</head>', () => styleBlock + '\n</head>');
html = html.replace('</body>', () => scriptBlock + '\n</body>');

/* 서비스워커 등록 블록은 통째로 빼기 — 단독판엔 sw.js 가 없다 */
html = html.replace(/<script>\s*\/\* 서비스 워커[\s\S]*?<\/script>/, '');

/* 단독판 표시 — 어디서 온 파일인지 알 수 있게 */
const stamp = process.env.DG_BUILD_STAMP || '';
const banner = `<!-- ${GAME} 단독 실행판 (build/build-single.mjs 로 생성${stamp ? ' · ' + stamp : ''}) -->\n<title>`;
html = html.replace('<title>', () => banner);

fs.mkdirSync(DIST, { recursive: true });
const outPath = path.join(DIST, OUT_NAME);
fs.writeFileSync(outPath, html, 'utf8');

/* 실행용 배치 — 한글 cmd(CP949)가 UTF-8 한글을 오파싱하므로 **내용은 ASCII 만** 쓴다.
   파일 이름이 한글이라 경로를 적을 수 없으니, 폴더의 html 을 훑어서 연다. */
fs.writeFileSync(path.join(DIST, 'play.bat'),
  '@echo off\r\n' +
  'REM Yeoksa-GO standalone launcher (double-click me)\r\n' +
  'cd /d "%~dp0"\r\n' +
  'for %%f in (*.html) do start "" "%%f"\r\n',
  'ascii');

fs.writeFileSync(path.join(DIST, '사용법.txt'),
  [
    GAME + ' 단독 실행판',
    '',
    '1) 이 폴더를 통째로 집 PC 로 복사하세요 (USB · 메일 · 클라우드 아무거나).',
    '2) play.bat 을 더블클릭하면 기본 브라우저로 열립니다.',
    '   (' + OUT_NAME + ' 을 직접 더블클릭해도 같습니다)',
    '',
    '조작',
    '  이동      WASD · 방향키 (Shift 달리기) · 빈 땅을 클릭하면 그쪽으로 걸어갑니다',
    '  자동      🤖 버튼 — 대신 걷고 만나고 던전을 돕니다 (세부 설정은 🔮 사관)',
    '  던전      🕳️ 버튼 — 이동 WASD · 스킬 1 2 3 4',
    '',
    '알아 둘 것',
    '  · 세이브는 그 PC 의 브라우저에 남습니다. 다른 PC 로는 따라가지 않습니다.',
    '  · 인터넷이 되면 실제 지도가 깔리고, 안 되면 그림 지형으로 바뀝니다 (게임은 그대로).',
    '  · 실제 위치(GPS)는 파일로 열면 브라우저가 막습니다 — 지도 위를 걷는 방식으로 노세요.',
    '  · 폰에서 하려면 이 파일이 아니라 안드로이드 APK 를 쓰세요 (mobile/ 참고).',
    ''
  ].join('\r\n'), 'utf8');

const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(`단독 실행판 완료 — dist/${OUT_NAME} (${kb}KB)`);
console.log(`  스타일 ${cssParts.length}개 · 스크립트 ${jsParts.length}개 인라인`);
console.log(`  같이 만든 것: dist/play.bat · dist/사용법.txt`);
