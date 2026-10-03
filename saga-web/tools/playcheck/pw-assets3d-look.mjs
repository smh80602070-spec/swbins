// 통일 3D 영웅 몸이 "검거나 안 보이게" 서지 않는지 화소로 잰다 — 스크린샷을 남기지 않는다(W-0021)
//   node pw-assets3d-look.mjs <판 폴더>        예) node pw-assets3d-look.mjs saga-go
// 영웅 표본 둘을 세워(통일 GLB) 가운데에 놓고 three 로 한 장 그려 화소를 읽는다: 배경이 아닌 화소 비율(몸이 보이나)·그 화소의 평균 밝기(0~255, 너무 어둡지 않나).
// 같은 방식으로 옛 몸(`assets3d.root` 를 막아 옛 길로 세운 것)과 견줘 밝기가 크게 다르지 않은지 본다. 어긋나면 종료 1.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2];
if (!game) { console.log('사용: node pw-assets3d-look.mjs saga-go'); process.exit(1); }
const r = await open(game);
const { page } = r;
await page.goto(r.url('index.html')); await sleep(1500);
const out = await page.evaluate(async (game) => {
  const A = window.DG.assets3d, T = window.THREE, A3 = window.DG.asset3d;
  await new Promise((ok) => A.whenSettled(ok));
  if (A.state() !== 'ok') { return { error: '조회 ' + A.state() }; }
  const ids = (window.DG.data.heroes || []).filter((h) => A.has('hero', h.id)).slice(0, 2);
  const mk = (h) => new Promise((ok) => {
    const done = (m) => ok(m);
    if (game === 'saga-forest') { A3.build('hero', h, done); return; }
    if (game === 'saga-story') { A3.buildHero(h.id, 42, null, done); return; }
    if (game === 'saga-realm') { A3.buildHero(h, null, done); return; }
    const shell = game === 'saga-dungeon' ? A3.buildHero('hero:' + h.id, 42, null, null) : A3.build('hero', h, null);
    let n = 0;
    (function poll() { if (A3.tick) { A3.tick(); } const st = shell.userData.assetState; if (st === 'glb' || st === 'fail' || ++n > 120) { ok(st === 'glb' ? shell : null); } else { setTimeout(poll, 250); } })();
  });
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(256, 256, false); renderer.setClearColor(0xff00ff, 1);   // 마젠타 배경 — 몸 화소만 골라낸다
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new T.AmbientLight(0xffffff, 0.8)); const d = new T.DirectionalLight(0xffffff, 1.0); d.position.set(2, 4, 3); scene.add(d);
  const res = [];
  for (const h of ids) {
    const m = await Promise.race([mk(h), new Promise((ok) => setTimeout(() => ok(null), 30000))]);
    if (!m) { res.push({ id: h.id, error: '못 세움' }); continue; }
    const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
    scene.add(m);
    const dist = Math.max(size.y, size.x) * 2.6; cam.near = dist / 100; cam.far = dist * 5; cam.updateProjectionMatrix();   // 판마다 키 단위가 다르다(1m·42px)
    cam.position.set(c.x, c.y, c.z + dist); cam.lookAt(c);
    renderer.render(scene, cam);
    const px = new Uint8Array(256 * 256 * 4); const gl = renderer.getContext();
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let body = 0, lum = 0;
    for (let i = 0; i < px.length; i += 4) { if (!(px[i] > 240 && px[i + 1] < 15 && px[i + 2] > 240)) { body++; lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; } }
    res.push({ id: h.id, height_m: +size.y.toFixed(2), bodyFrac: +(body / 65536).toFixed(3), meanLum: body ? +(lum / body).toFixed(1) : 0 });
    scene.remove(m);
  }
  return { heroes: res };
}, game);
console.log(JSON.stringify(out, null, 1));
const bad = [];
if (out.error) { bad.push(out.error); }
(out.heroes || []).forEach((h) => { if (h.error || h.bodyFrac < 0.03 || h.meanLum < 25) { bad.push(h.id + (h.error ? ' ' + h.error : ' 보임 ' + h.bodyFrac + ' 밝기 ' + h.meanLum)); } });
if (!(out.heroes || []).length && !out.error) { bad.push('표본 0'); }
console.log(bad.length ? 'FAIL ' + bad.join(' · ') : 'OK 영웅 ' + out.heroes.length + ' — 몸이 보이고 어둡지 않다');
await r.close();
process.exit(bad.length ? 1 : 0);
