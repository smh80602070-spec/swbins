// 옷 무늬(W-0020)가 실제로 표를 받고 옷 재질에 입혀지는지 본다 — vroid-variant 의 patLoad·patWear
//   node pw-patterns.mjs <판 폴더>        예) node pw-patterns.mjs saga-go
// 가짜 옷(재질 이름 `…_CLOTH`)을 만들어 V.apply 를 부르고, 표가 64줄 들어오는지·옷 재질에 무늬 맵이 붙는지·머리 재질엔 안 붙는지 본다. 스크린샷 없음.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2] || 'saga-go';
const r = await open(game);
await r.page.goto(r.url('index.html')); await sleep(1500);
const out = await r.page.evaluate(async () => {
  const V = window.DG.vroidVariant, T = window.THREE, A = window.DG.assets3d;
  if (!V || !T) { return { error: 'vroidVariant/three 없음' }; }
  await new Promise((ok) => A.whenSettled(ok));
  function mat(name) { return new T.MeshStandardMaterial({ name, color: 0xffffff }); }
  const g = new T.Group();
  const cloth = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat('N00_005_01_Tops_01_CLOTH (Instance)'));
  const hair = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat('N00_000_Hair_00_HAIR_01 (Instance)'));
  g.add(cloth, hair);
  V.apply(g, 'pat_probe_1');
  for (let i = 0; i < 40 && !(V._pat && V._pat.list); i++) { await new Promise((ok) => setTimeout(ok, 150)); }
  const listN = V._pat && V._pat.list ? V._pat.list.length : 0;
  V.apply(g, 'pat_probe_1');
  await new Promise((ok) => setTimeout(ok, 300));
  const m = cloth.material, texOk = await new Promise((ok) => {
    const t = m.map; if (!t) { ok(false); return; }
    const im = t.image; if (im && im.complete && im.naturalWidth) { ok(true); return; }
    let n = 0; (function w() { const i2 = t.image; if (i2 && i2.complete && i2.naturalWidth) { ok(true); } else if (++n > 40) { ok(false); } else { setTimeout(w, 150); } })();
  });
  return { base: A.root(), listN, clothHasMap: !!m.map, mapLoaded: texOk, hairHasMap: !!hair.material.map, dead: !!(V._pat && V._pat.dead) };
});
console.log(JSON.stringify(out, null, 1));
const bad = [];
if (out.error) { bad.push(out.error); } else {
  if (out.listN !== 64) { bad.push('표 ' + out.listN + '줄(64 기대)'); }
  if (!out.clothHasMap || !out.mapLoaded) { bad.push('옷 무늬 안 입혀짐/이미지 못 받음'); }
  if (out.hairHasMap) { bad.push('머리에 무늬가 붙음'); }
}
console.log(bad.length ? 'FAIL ' + bad.join(' · ') : 'OK 표 64 · 옷에 무늬 입혀짐 · 머리 안 붙음');
await r.close();
process.exit(bad.length ? 1 : 0);
