// 통일 3D 에셋(W-0021)이 실제로 받아지고 조립되는지 본다 — DG.assets3d + asset3d.build
//   node pw-assets3d.mjs <판 폴더>        예) node pw-assets3d.mjs saga-go
// ① 조회 시험이 ok 로 끝나나 ② 영웅 표본(`DG.data.heroes 중 GLB 가 있는 앞 몇 명)을 asset3d.build('hero') 로 세워 assetState 가 glb 이고
// 자체 몸짓(클립)이 구워지나 ③ 지물·건물 표본 GLB 를 GLTFLoader(+Meshopt)로 받아 파싱되나. 스크린샷 아님. 하나라도 어긋나면 종료 1.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다 — 이 서버는 `/_shared` 를 모르므로 `../shared` 쪽이 쓰인다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2];
if (!game) { console.log('사용: node pw-assets3d.mjs saga-go'); process.exit(1); }
const r = await open(game);
const { page } = r;
await page.goto(r.url('index.html')); await sleep(1500);
const out = await page.evaluate(async (game) => {
  const A = window.DG.assets3d, res = { state: null, root: null, heroes: [], world: [] };
  if (!A) { return { error: 'DG.assets3d 없음' }; }
  await new Promise((ok) => A.whenSettled(ok));
  res.state = A.state(); res.root = A.root();
  if (res.state !== 'ok') { return res; }
  const heroes = (window.DG.data.heroes || []).filter((h) => A.has('hero', h.id)).slice(0, 3);
  for (const h of heroes) {
    const A3 = window.DG.asset3d;
    const shell = game === 'saga-dungeon' ? A3.buildHero('hero:' + h.id, 42, null, null) : A3.build('hero', h, null);   // 사가블로는 'hero:<id>' 씨앗
    let st = null;
    for (let i = 0; i < 120 && st !== 'glb' && st !== 'fail'; i++) { await new Promise((ok) => setTimeout(ok, 250)); if (A3.tick) { A3.tick(); } st = shell && shell.userData && shell.userData.assetState; }
    res.heroes.push({ id: h.id, state: st, own: !!(shell && shell.userData.ownAnim), clips: shell && shell.userData.actions ? Object.keys(shell.userData.actions).length : 0 });
  }
  const T = window.THREE || (window.DG.three && window.DG.three());
  const loader = new T.GLTFLoader();
  if (T.MeshoptDecoder) { loader.setMeshoptDecoder(T.MeshoptDecoder); }
  const cfgA = window.DG.cfg.assets3d || {}, want = new Set();
  Object.values(cfgA.prop || {}).concat(Object.values(cfgA.reg || {})).forEach((l) => l.forEach((id) => want.add(id)));
  for (const id of (want.size ? [...want] : ['eu_house_01', 'street_lamp_01', 'sail_boat_01'])) {
    const u = A.url('world', id);
    const row = { id, url: u && u.replace(/^.*shared\//, ''), ok: false, meshes: 0 };
    if (u) {
      try { const g = await loader.loadAsync(u); g.scene.traverse((o) => { if (o.isMesh) { row.meshes++; } }); row.ok = row.meshes > 0; } catch (e) { row.err = String(e.message || e).slice(0, 80); }
    }
    res.world.push(row);
  }
  /* 소품 표(cfg.assets3d.prop) — prop3d 가 통일 GLB 를 고르고 실제로 받아 둔다 */
  const P3 = window.DG.prop3d, props = (window.DG.cfg.assets3d || {}).prop || {};
  res.props = [];
  if (P3) {
    await new Promise((ok) => setTimeout(ok, 500));
    for (const name of Object.keys(props)) {
      const u = P3.pick(name, 3, 5, 'all');
      let rd = false;
      for (let i = 0; i < 80 && !rd; i++) { rd = P3.ready(name, 3, 5, 'all'); if (!rd) { P3.parts(name, 3, 5, 'all'); await new Promise((ok) => setTimeout(ok, 250)); } }
      res.props.push({ name, url: u && u.replace(/^.*shared\//, ''), unified: !!u && u.indexOf('world3d/') >= 0, ready: rd });
    }
  }
  /* asset3d 등록 표(cfg.assets3d.reg) — 키마다 통일 GLB 로 바뀌었나 */
  res.reg = [];
  const A3 = window.DG.asset3d, REG = A3 && A3.register ? A3.register() : null;
  if (REG) {
    for (const key of Object.keys(cfgA.reg || {})) { const v = [].concat(REG[key] || []); res.reg.push({ key, unified: v.length > 0 && v.every((u) => String(u).indexOf('world3d/') >= 0) }); }
  }
  return res;
}, game);
console.log(JSON.stringify(out, null, 1));
const bad = [];
if (out.error || out.state !== 'ok') { bad.push('조회 ' + (out.error || out.state)); }
(out.heroes || []).forEach((h) => { if (h.state !== 'glb' || !h.own || h.clips < 1) { bad.push('영웅 ' + h.id); } });
if (out.heroes && !out.heroes.length) { bad.push('영웅 표본 0'); }
(out.world || []).forEach((w) => { if (!w.ok) { bad.push('지물 ' + w.id); } });
(out.reg || []).forEach((q) => { if (!q.unified) { bad.push('등록 ' + q.key); } });
(out.props || []).forEach((q) => { if (!q.unified || !q.ready) { bad.push('소품 ' + q.name); } });
console.log(bad.length ? 'FAIL ' + bad.join(' · ') : 'OK 영웅 ' + out.heroes.length + ' · 지물 ' + out.world.length + ' · 소품 ' + (out.props || []).length);
await r.close();
process.exit(bad.length ? 1 : 0);
