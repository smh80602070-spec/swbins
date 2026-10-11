/**
 * 초상 굽기 (SAGA-DESIGN §11 Phase 1) — 도감·카드 초상을 오프라인으로 한 번 구워
 * `<게임>/assets/portraits/` 에 webp 파일로 둔다. 게임은 이 파일을 곧바로 <img> 로 쓴다.
 *
 *   node tools/bake-portraits/bake.mjs <게임폴더> [--kind=hero|pet] [--limit=N] [--only=id,id]
 *   node tools/bake-portraits/bake.mjs saga-dungeon --sprites=monsters   (적 짐승 몸 → 옆모습 걷기 시트 assets/sprites2d/mon_*.webp)
 *   node tools/bake-portraits/bake.mjs saga-dungeon --sprites=people [--only=h_x,n_y] (사람 3D 몸 → 인물별 걷기 시트 assets/sprites2d/people/*.webp)
 *   node tools/bake-portraits/bake.mjs saga-forest --sprites=animals [--only=wolf,rabbit] (들짐승 3D → 2D 지도 시트 assets/sprites2d/animals/<종류>.png)
 *   (2026-09-23 까지는 짐승 외곽선이 검은 파편으로 번져 `--tune=world3d.outline:0` 로 끄고 구웠다 — 외곽선 폭·스키닝 순서를 고쳐 이제 켜고 굽는다)
 *   node tools/bake-portraits/bake.mjs saga-go --manifest-only   (W-0164 — 굽지 않고 assets/portraits/<hero|pet>/*_s|c.webp 를 훑어 manifest.js 에 합친다. data.js 의 id 만, 크롬 안 띄움)
 *   부가 옵션: --tune=키:값(굽는 동안 손잡이) --gl=d3d11(실제 GPU) --out=경로 --eval=파일.js(페이지 안에서 스크립트 실행)
 *
 * 그림은 **게임 자신의 `DG.portrait3d.warm()`** 이 굽는다 — 이 도구는 헤드리스 크롬(swiftshader)을
 * CDP 로 부려 결과 dataURL 을 webp 로 바꿔 받을 뿐이다. 그래서 다섯 판이 각자 다른 굽기 방식
 * (콜백/폴링, 굽는 대상 범위)을 가져도 도구는 하나다.
 *
 * 자리: 정사각(초상 96px → 192px)과 카드(150×172 → 300×344) 두 벌. 구워지지 않은 것(3D 모델이
 * 없는 펫·이 판이 안 굽는 종류)은 파일이 없고 `manifest.js` 에도 안 적힌다 → 게임은 여태처럼 굽는다.
 *
 * 헤드리스 크롬은 끝나면 이 스크립트가 **자기가 띄운 PID 만** 죽인다(크롬 통째 kill 금지).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';

const args = process.argv.slice(2);
const gameDir = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SQ = { w: 96, h: 96, tag: 's' }, CARD = { w: 150, h: 172, tag: 'c' };
const QUALITY = 0.8;
const OUT = path.resolve(opt.out || path.join(gameDir, 'assets', 'portraits'));
/* W-0164 — 디스크만 보고 목록에 올린다(그림은 안 만든다). K 가 AI 초상을 바로 놓았을 때 쓴다 */
if (opt['manifest-only']) {
  const vm = await import('node:vm');
  const win = { console }; win.window = win; win.globalThis = win;
  let known = null;
  try {
    vm.runInNewContext(fs.readFileSync(path.join(gameDir, 'js', 'data.js'), 'utf8'), win);
    const D = win.DG && win.DG.data;
    known = { hero: new Set((D.heroes || []).map((h) => h.id)), pet: new Set((D.pets || []).map((p) => p.id)) };
  } catch (e) { console.log('경고: data.js 를 못 읽어 디스크 파일을 전부 올린다 — ' + e.message); }
  const mfPath = path.join(OUT, 'manifest.js');
  let prev = { hero: { s: '', c: '' }, pet: { s: '', c: '' } };
  if (fs.existsSync(mfPath)) { const m = fs.readFileSync(mfPath, 'utf8').match(/DG\.portraitDisk=(\{.*\});/s); if (m) prev = JSON.parse(m[1]).ids; }
  const ids = {}, added = { hero: 0, pet: 0 };
  for (const k of ['hero', 'pet']) {
    ids[k] = {};
    const dir = path.join(OUT, k), files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    for (const t of ['s', 'c']) {
      const set = new Set(String((prev[k] && prev[k][t]) || '').split(',').filter(Boolean)), n0 = set.size, tail = '_' + t + '.webp';
      for (const fn of files) {
        if (!fn.endsWith(tail)) { continue; }
        const id = fn.slice(0, -tail.length);
        if (!known || known[k].has(id)) { set.add(id); }
      }
      ids[k][t] = [...set].sort().join(',');
      added[k] += set.size - n0;
      console.log(k + ' ' + t + ' ' + n0 + ' → ' + set.size);
    }
  }
  fs.writeFileSync(mfPath, `/* bake-portraits 가 쓴다 — 손으로 고치지 않는다. 구운 초상 목록(s=정사각 96, c=카드 150×172). */\n(function(g){g.DG=g.DG||{};g.DG.portraitDisk=${JSON.stringify({ v: 1, base: 'assets/portraits/', ids })};})(window);\n`);
  console.log('manifest.js 갱신(굽기 없음) — 더한 수 hero ' + added.hero + ' · pet ' + added.pet);
  process.exit(0);
}


const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.hdr': 'application/octet-stream', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(gameDir, p);
  if (!f.startsWith(gameDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const dbg = 9400 + Math.floor(Math.random() * 500);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'bakeprof-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${prof}`,
  ...(opt.gl ? ['--use-angle=' + opt.gl, '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox']),
  '--force-device-scale-factor=2', '--window-size=900,700', '--no-first-run', '--mute-audio',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'
], { stdio: 'ignore' });

function done(code) {
  try { chrome.kill(); } catch (e) { /* 이미 끝남 */ }
  try { server.close(); } catch (e) { /* */ }
  setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* */ } process.exit(code); }, 500);
}
process.on('SIGINT', () => done(1));

async function getWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${dbg}/json`);
      const list = await r.json();
      const t = list.find(x => x.type === 'page');
      if (t) return t.webSocketDebuggerUrl;
    } catch (e) { /* 아직 안 떴다 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('크롬 디버그 포트가 안 열림');
}

const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nid = 0; const waits = new Map(); const logs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && waits.has(m.id)) { const w = waits.get(m.id); waits.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') { logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); }
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nid; waits.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
async function evalJs(expr, timeout = 120000) {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate 시간 초과')), timeout))
  ]);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });

  /* three·데이터·굽기 준비 — 스크립트가 다 올라올 때까지 */
  let ok = false;
  for (let i = 0; i < 120 && !ok; i++) {
    await new Promise(r => setTimeout(r, 1000));
    ok = await evalJs(`!!(window.DG && DG.portrait3d && DG.data && DG.data.heroes && window.THREE && DG.portrait3d.ready())`).catch(() => false);
  }
  if (!ok) throw new Error('게임이 준비되지 않음(portrait3d.ready 거짓) ' + logs.slice(0, 3).join(' | '));

  /* 이미 구운 디스크 초상이 굽기를 가로채지 않게 — 다시 굽는 것은 게임의 3D 굽기여야 한다 */
  await evalJs('window.DG.portraitDisk = null; true');

  /* 페이지 쪽 굽는 함수 — 한 개 굽고 webp dataURL 을 돌려준다(못 구우면 null) */
  await evalJs(`(function () {
    /* 사가나락처럼 무거운 조립을 게임 루프의 asset3d.tick() 이 한 프레임에 하나씩 비우는 판이 있다 — 굽기 페이지엔 루프가 없으니 대신 돌린다 */
    if (DG.asset3d && DG.asset3d.tick) { setInterval(function () { try { DG.asset3d.tick(); } catch (e) { /* 조립 실패는 게임 쪽 기록 */ } }, 40); }
    window.__bake = function (kind, id, w, h, quality) {
      return new Promise(function (resolve) {
        var P = DG.portrait3d, ref = DG.data.find(id);
        if (!ref) { resolve(null); return; }
        var t0 = Date.now();
        P.warm(kind, ref, w, h);
        (function poll() {
          var u = P.of(kind, ref, w, h);
          if (u) {
            var im = new Image();
            im.onload = function () {
              var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
              c.getContext('2d').drawImage(im, 0, 0);
              resolve(c.toDataURL('image/webp', quality));
            };
            im.onerror = function () { resolve(null); };
            im.src = u; return;
          }
          if (Date.now() - t0 > 45000 || (P.willSwap && !P.willSwap(kind, ref, w, h) && Date.now() - t0 > 1500)) { resolve(null); return; }
          setTimeout(poll, 120);
        })();
      });
    };
    return true;
  })()`);

  /* --eval=파일.js : 페이지 안에서 그 스크립트를 돌려 결과를 찍고 끝낸다(굽기가 안 될 때 원인 캐기용) */
  if (opt.eval) { console.log(JSON.stringify(await evalJs(fs.readFileSync(opt.eval, 'utf8'), 90000)), logs.slice(0, 5)); done(0); await new Promise(() => {}); }

  /* --tune=키:값 — 굽는 동안만 손잡이를 바꾼다(예: 외곽선 끄기 world3d.outline:0). 임시 프로필이라 세이브에 안 남는다 */
  if (opt.tune) { for (const kv of String(opt.tune).split(',')) { const [k, v] = kv.split(':'); await evalJs('DG.core.setTune(' + JSON.stringify(k) + ', ' + Number(v) + '); true'); } }

  /* ── --sprites=monsters : 적 짐승의 3D 몸을 옆모습 걷기 시트로 굽는다(SAGA-DESIGN §11 Phase 3) ──
   * 몸 키(`data-enemy.js` 의 body, 없으면 'beast')마다 5컷 가로 시트 — 걷기 4컷 + 서 있기 1컷, 컷당 128px 정사각,
   * 발이 아래·몸 중심이 가운데, 앞(+Z)이 **오른쪽**(카메라가 -X 에서 +X 를 본다). 컷 사이 배율은 같다(흔들림 없게).
   * 결과 `assets/sprites2d/mon_<몸>.webp` + `mon-manifest.js`(굽힌 키 목록). */
  if (opt.sprites === 'monsters' || opt.sprites === 'people') {
    await evalJs(`(function () {
      var T = THREE, A3 = DG.asset3d, R = null, scene = null, cam = null, rig = null, CELL = ${opt.sprites === 'people' ? Number(opt.cell || 96) : 128}, SS = 2;
      function boot() {
        if (R) { return; }
        var cv = document.createElement('canvas');
        R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
        R.setClearColor(0x000000, 0); R.setPixelRatio(1); R.setSize(CELL * SS, CELL * SS, false);
        if (T.ACESFilmicToneMapping) { R.toneMapping = T.ACESFilmicToneMapping; }
        R.toneMappingExposure = ${Number(opt.expo || 1.2)};
        if (T.SRGBColorSpace) { R.outputColorSpace = T.SRGBColorSpace; }
        scene = new T.Scene();
        scene.add(new T.HemisphereLight(0xdce8ff, 0x746a5c, 2.2));
        var sun = new T.DirectionalLight(0xfff3dc, 1.9); sun.position.set(-1.2, 1.7, 0.7); scene.add(sun);
        var fill = new T.DirectionalLight(0xbdd2ee, 0.9); fill.position.set(-0.8, 0.6, -1.2); scene.add(fill);
        cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
        rig = new T.Group(); scene.add(rig);
      }
      function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
      window.__bakeSprite = function (key, quality) {
        return bakeNode(A3.build(key, 'spr', 42, null, function () { return new T.Group(); }), quality);
      };
      /* --sprites=people : 3D 가 세우는 것과 같은 씨앗·물빛의 사람 몸(sprite.peopleList 한 줄) */
      window.__bakePerson = function (p, quality) {
        return bakeNode(p.model ? A3.build(p.model, p.seed, 42, null, function () { return new T.Group(); })
          : A3.buildHero(p.seed, 42, p.tint, null), quality);
      };
      async function bakeNode(node, quality) {
        boot();
        for (var i = 0; i < 300 && node.userData.assetState === 'shape'; i++) { await sleep(100); }
        if (node.userData.assetState !== 'glb') { return null; }
        while (rig.children.length) { rig.remove(rig.children[0]); }
        rig.add(node);
        var u = node.userData, dur = 1, hasWalk = false;
        A3.step(node, { t: 0, walking: true });                       // 걷기 슬롯을 켠다
        var wa = u.actions && u.clipMap && u.actions[u.clipMap.walk];
        if (wa) { hasWalk = true; dur = wa.getClip().duration || 1; }
        function pose(f) {
          if (f < 4) { A3.play(node, hasWalk ? 'walk' : 'idle'); if (u.mixer) { u.mixer.setTime(hasWalk ? f / 4 * dur : 0); } }
          else { A3.play(node, 'idle'); if (u.mixer) { u.mixer.setTime(0.2); } }
          node.updateMatrixWorld(true);
        }
        var box = new T.Box3(), tmp = new T.Box3(), f;
        for (f = 0; f < 5; f++) { pose(f); tmp.setFromObject(node, true); if (!tmp.isEmpty()) { box.union(tmp); } }
        if (box.isEmpty()) { return null; }
        var cy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
        var h = box.max.y - box.min.y, d = box.max.z - box.min.z, half = Math.max(h, d) / 2 * 1.06;
        cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
        cam.position.set(-2000, cy, cz); cam.lookAt(0, cy, cz);
        var out = document.createElement('canvas'); out.width = CELL * 5; out.height = CELL;
        var oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';
        for (f = 0; f < 5; f++) { pose(f); R.render(scene, cam); oc.drawImage(R.domElement, f * CELL, 0, CELL, CELL); }
        rig.remove(node);
        return out.toDataURL('image/webp', quality);
      };
      return true;
    })()`);
    /* ── --sprites=people : 사람(도감 인물·마을 사람·사람 적)마다 3D 몸을 옆모습 걷기 시트로(2026-09-25, CHARACTER_UNIQUENESS ⑤) ──
     * 목록은 게임의 `DG.sprite.peopleList()`(줄기·씨앗·물빛·folk 몸) — 결과 `assets/sprites2d/people/<줄기>.webp` + `people-manifest.js`.
     * 몬스터 시트와 같은 5컷 가로(걷기 4 + 서기 1), 컷 --cell(기본 96)px. --only=줄기,… 로 일부만 */
    if (opt.sprites === 'people') {
      const list = await evalJs('DG.sprite.peopleList()');
      const outDir = path.resolve(opt.out || path.join(gameDir, 'assets', 'sprites2d', 'people'));
      fs.mkdirSync(outDir, { recursive: true });
      const onlyP = opt.only ? String(opt.only).split(',') : null;
      const okP = []; const badP = [];
      for (const p of list.filter(x => !onlyP || onlyP.includes(x.stem))) {
        const url = await evalJs(`window.__bakePerson(${JSON.stringify(p)}, 0.85)`, 90000).catch(() => null);
        if (url && url.startsWith('data:image/webp')) { fs.writeFileSync(path.join(outDir, `${p.stem}.webp`), Buffer.from(url.split(',')[1], 'base64')); okP.push(p.stem); }
        else { badP.push(p.stem); }
        if ((okP.length + badP.length) % 20 === 0) { console.log(`… ${okP.length + badP.length}/${list.length}`); }
      }
      const pmf = path.join(path.dirname(outDir), 'people-manifest.js');
      let prevP = [];
      if (fs.existsSync(pmf)) { const m = fs.readFileSync(pmf, 'utf8').match(/keys:"([^"]*)"/); if (m && m[1]) { prevP = m[1].split(','); } }
      const allP = [...new Set([...prevP, ...okP])].filter(k => fs.existsSync(path.join(outDir, k + '.webp'))).sort();
      fs.writeFileSync(pmf, `/* bake-portraits --sprites=people 가 쓴다 — 손으로 고치지 않는다. 사람마다 5컷 가로 시트(걷기 4 + 서기 1), 컷 ${Number(opt.cell || 96)}px, people/<줄기>.webp. */
(function(g){g.DG=g.DG||{};g.DG.peopleSprites={v:1,cell:${Number(opt.cell || 96)},walk:4,keys:"${allP.join(',')}"};})(window);
`);
      console.log(`사람 시트 — 구움 ${okP.length}, 못 구움 ${badP.length}${badP.length ? ' (' + badP.join(',') + ')' : ''}`);
      done(0);
      await new Promise(() => {});
    }
    const keys = await evalJs(`(function () {
      var E = DG.enemyData, seen = {}, out = [];
      (E.enemies || []).concat(E.bosses || [], E.eraEnemies || []).forEach(function (e) { if (e.kind === 'beast') { var k = e.body || 'beast'; if (!seen[k]) { seen[k] = 1; out.push(k); } } });
      return out;
    })()`);
    fs.mkdirSync(path.join(gameDir, 'assets', 'sprites2d'), { recursive: true });
    const outDir = path.resolve(opt.out || path.join(gameDir, 'assets', 'sprites2d'));
    fs.mkdirSync(outDir, { recursive: true });
    const only2 = opt.only ? String(opt.only).split(',') : null;
    const okKeys = []; const bad = [];
    for (const k of keys.filter(x => !only2 || only2.includes(x))) {
      const url = await evalJs(`window.__bakeSprite(${JSON.stringify(k)}, 0.85)`, 70000).catch(() => null);
      if (url && url.startsWith('data:image/webp')) { fs.writeFileSync(path.join(outDir, `mon_${k}.webp`), Buffer.from(url.split(',')[1], 'base64')); okKeys.push(k); }
      else { bad.push(k); }
    }
    const mfp = path.join(outDir, 'mon-manifest.js');
    let prevKeys = [];
    if (fs.existsSync(mfp)) { const m = fs.readFileSync(mfp, 'utf8').match(/keys:"([^"]*)"/); if (m && m[1]) { prevKeys = m[1].split(','); } }
    const all = [...new Set([...prevKeys, ...okKeys])].sort();
    fs.writeFileSync(mfp, `/* bake-portraits --sprites=monsters 가 쓴다 — 손으로 고치지 않는다. 5컷 가로 시트(걷기 4 + 서기 1), 컷 128px. */\n(function(g){g.DG=g.DG||{};g.DG.monsterSprites={v:1,cell:128,walk:4,keys:"${all.join(',')}"};})(window);\n`);
    console.log(`몬스터 시트 — 구움 ${okKeys.length}, 못 구움 ${bad.length}${bad.length ? ' (' + bad.join(',') + ')' : ''}`);
    done(0);
    await new Promise(() => {});
  }

  /* ── --sprites=animals : 사가마을 들짐승(VD.ANIMALS)의 3D 몸을 2D 지도 시트로 굽는다(2026-09-25, CHARACTER_UNIQUENESS ⑤) ──
   * `village-view.js` `ANIMAL_SPRITE` 과 같은 모양 — 4줄(0 서기·왼쪽 / 1 서기·오른쪽 / 2 달리기·왼쪽 / 3 달리기·오른쪽) × 4컷,
   * 컷 CW×CH px. 앞(+Z)이 오른쪽(카메라가 -X 에서 +X 를 본다), 왼쪽 줄은 좌우를 뒤집는다. 발이 아래, 여덟 자세를 다 담는 한 배율.
   * 클립이 없는 정지 모델(토끼·오리)은 달리기 줄을 깡충 뛰는 높이 차로 가른다. 결과 `assets/sprites2d/animals/<종류>.png` */
  if (opt.sprites === 'animals') {
    const CW = Number(opt.cw || 44), CH = Number(opt.ch || 36);
    await evalJs(`(function () {
      var T = THREE, A3 = DG.asset3d, R = null, scene = null, cam = null, rig = null, SS = 4, CW = ${CW}, CH = ${CH};
      function boot() {
        if (R) { return; }
        var cv = document.createElement('canvas');
        R = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
        R.setClearColor(0x000000, 0); R.setPixelRatio(1); R.setSize(CW * SS, CH * SS, false);
        if (T.SRGBColorSpace) { R.outputColorSpace = T.SRGBColorSpace; }
        scene = new T.Scene();
        scene.add(new T.HemisphereLight(0xfff6e8, 0x6a6250, 2.4));
        var sun = new T.DirectionalLight(0xfff3dc, 1.8); sun.position.set(-1.2, 1.7, 0.7); scene.add(sun);
        cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
        rig = new T.Group(); scene.add(rig);
      }
      function built(kind, id) { return new Promise(function (res) { A3.build(kind, { id: id }, res); setTimeout(function () { res(null); }, 40000); }); }
      window.__bakeAnimal = async function (kind) {
        boot();
        var node = (await built('animal', 'an_' + kind)) || (await built('monster', kind));   // 희귀 괴물(포자괴물·성간충)은 monster:<종류>
        if (!node) { return null; }
        while (rig.children.length) { rig.remove(rig.children[0]); }
        rig.add(node);
        var u = node.userData, cm = u.clipMap || {}, acts = u.actions || {};
        var idleA = acts[cm.idle], runA = acts[cm.run] || acts[cm.walk];
        function pose(row, f) {
          var a = row >= 2 ? runA : idleA;
          if (u.mixer) { u.mixer.stopAllAction(); if (a) { a.reset().play(); u.mixer.setTime(f / 4 * (a.getClip().duration || 1)); } }
          node.updateMatrixWorld(true);
        }
        var box = new T.Box3(), tmp = new T.Box3(), r, f;
        for (r = 1; r <= 3; r += 2) { for (f = 0; f < 4; f++) { pose(r, f); tmp.setFromObject(node, true); if (!tmp.isEmpty()) { box.union(tmp); } } }
        if (box.isEmpty()) { return null; }
        var hop = !runA ? [0, 0.12, 0.18, 0.12] : [0, 0, 0, 0];        // 정지 모델 — 달리기 줄은 깡충(몸 키 비율)
        var h = (box.max.y - box.min.y) * (1 + 0.18), d = box.max.z - box.min.z, cz = (box.min.z + box.max.z) / 2;
        var halfH = Math.max(h, d * CH / CW) / 2 * 1.06, halfW = halfH * CW / CH, cy = box.min.y + halfH * 0.98;
        cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH; cam.updateProjectionMatrix();
        cam.position.set(-2000, cy, cz); cam.lookAt(0, cy, cz);
        var out = document.createElement('canvas'); out.width = CW * 4; out.height = CH * 4;
        var oc = out.getContext('2d'); oc.imageSmoothingQuality = 'high';
        for (r = 0; r < 4; r++) {
          for (f = 0; f < 4; f++) {
            pose(r, f);
            var lift = (r >= 2 ? hop[f] : 0) * (box.max.y - box.min.y);
            node.position.y = lift; node.updateMatrixWorld(true);
            R.render(scene, cam);
            node.position.y = 0;
            oc.save();
            if (r % 2 === 0) { oc.translate((f + 1) * CW, r * CH); oc.scale(-1, 1); } else { oc.translate(f * CW, r * CH); }
            oc.drawImage(R.domElement, 0, 0, CW, CH);
            oc.restore();
          }
        }
        rig.remove(node);
        return out.toDataURL('image/png');
      };
      return true;
    })()`);
    const kinds2 = opt.only ? String(opt.only).split(',') : ['wolf', 'rabbit', 'duck', 'snake'];
    const outDir = path.resolve(opt.out || path.join(gameDir, 'assets', 'sprites2d', 'animals'));
    fs.mkdirSync(outDir, { recursive: true });
    const okK = [], badK = [];
    for (const k of kinds2) {
      const url = await evalJs(`window.__bakeAnimal(${JSON.stringify(k)})`, 70000).catch(() => null);
      if (url && url.startsWith('data:image/png')) { fs.writeFileSync(path.join(outDir, `${k}.png`), Buffer.from(url.split(',')[1], 'base64')); okK.push(k); }
      else { badK.push(k); }
    }
    console.log(`들짐승 시트 ${CW}x${CH} — 구움 ${okK.length}, 못 구움 ${badK.length}${badK.length ? ' (' + badK.join(',') + ')' : ''}`);
    done(0);
    await new Promise(() => {});
  }

  const kinds = opt.kind ? [opt.kind] : ['hero', 'pet'];
  const only = opt.only ? String(opt.only).split(',') : null;
  const manifest = { hero: { s: [], c: [] }, pet: { s: [], c: [] } };
  const t0 = Date.now();
  fs.mkdirSync(OUT, { recursive: true });

  for (const kind of kinds) {
    let ids = await evalJs(`DG.data.${kind === 'hero' ? 'heroes' : 'pets'}.map(function (x) { return x.id; })`);
    if (only) ids = ids.filter(i => only.includes(i));
    if (opt.limit) ids = ids.slice(0, +opt.limit);
    fs.mkdirSync(path.join(OUT, kind), { recursive: true });
    let n = 0, miss = 0;
    for (const id of ids) {
      for (const sz of [SQ, CARD]) {
        const url = await evalJs(`window.__bake(${JSON.stringify(kind)}, ${JSON.stringify(id)}, ${sz.w}, ${sz.h}, ${QUALITY})`, 70000).catch(() => null);
        if (url && url.startsWith('data:image/webp')) {
          fs.writeFileSync(path.join(OUT, kind, `${id}_${sz.tag}.webp`), Buffer.from(url.split(',')[1], 'base64'));
          manifest[kind][sz.tag].push(id);
          n++;
        } else {
          miss++;
          if (miss <= 2) { console.log(`  못 구움 ${kind}:${id}:${sz.tag} — ` + (await evalJs('JSON.stringify(DG.portrait3d.stats())').catch(() => '?')) + (logs.length ? ' · 페이지 예외 ' + logs[logs.length - 1].slice(0, 160) : '')); }
        }
      }
      if ((n + miss) % 20 === 0) console.log(`${kind} ${n + miss}/${ids.length * 2}  ok ${n} miss ${miss}  ${Math.round((Date.now() - t0) / 1000)}s`);
    }
    console.log(`${kind} 끝 — 구움 ${n}, 못 구움 ${miss} (전체 ${ids.length * 2})`);
  }

  /* manifest — 부분 실행이면 기존 것과 합친다 */
  const mfPath = path.join(OUT, 'manifest.js');
  let prev = { hero: { s: '', c: '' }, pet: { s: '', c: '' } };
  if (fs.existsSync(mfPath)) {
    try { const m = fs.readFileSync(mfPath, 'utf8').match(/DG\.portraitDisk=(\{.*\});/s); if (m) prev = JSON.parse(m[1]).ids; } catch (e) { /* 새로 쓴다 */ }
  }
  const ids = {};
  for (const k of ['hero', 'pet']) {
    ids[k] = {};
    for (const t of ['s', 'c']) {
      const set = new Set([...(prev[k] && prev[k][t] ? String(prev[k][t]).split(',').filter(Boolean) : []), ...manifest[k][t]]);
      ids[k][t] = [...set].sort().join(',');
    }
  }
  fs.writeFileSync(mfPath, `/* bake-portraits 가 쓴다 — 손으로 고치지 않는다. 구운 초상 목록(s=정사각 96, c=카드 150×172). */\n(function(g){g.DG=g.DG||{};g.DG.portraitDisk=${JSON.stringify({ v: 1, base: 'assets/portraits/', ids })};})(window);\n`);
  console.log('manifest.js 갱신');
  if (logs.length) console.log('페이지 예외 ' + logs.length + '건, 첫 건: ' + logs[0].slice(0, 200));
  done(0);
} catch (e) {
  console.error('실패:', e.message);
  done(1);
}
