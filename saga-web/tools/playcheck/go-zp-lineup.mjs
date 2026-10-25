// W-0443 1만리 퓨전 소품 옛(Quaternius)·새(자체 world3d) 한 줄 세워 찍기 — 위 줄 옛, 아래 줄 새. 키는 FUSION h 비율 그대로.
//   node go-zp-lineup.mjs [저장 폴더]   (서버 :8871 — PW_BASE 로 바꿀 수 있다)
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.';
const PAIRS = [['Windmill_FirstAge', 'mill_01', 9], ['Hay', 'haystack_01', 1.3], ['Cart', 'handcart_01', 2], ['Tent', 'tent_small_01', 2.6], ['Wall_FirstAge', 'low_stone_wall_01', 3],
  ['Barrel', 'barrel_01', 1.2], ['Crate_Stack1', 'crate_stack_01', 1.6], ['Streetlight_Single', 'street_lamp_01', 6], ['GeodesicDome', 'future_dome_01', 7],
  ['Support_Long', 'steel_pylon_01', 12], ['PineTree_Snow_2', 'tree_pine_01_snow', 10], ['Rock_Snow_2', 'rock_large_01', 2]];
const r = await open('saga-go', { w: 1600, h: 640, gpu: !process.env.PW_SWIFT });
try {
  await r.page.goto(r.url('index.html')); await sleep(6000);
  const res = await r.page.evaluate(async (P) => {
    const T = window.THREE, L = new T.GLTFLoader(); if (T.MeshoptDecoder) { L.setMeshoptDecoder(T.MeshoptDecoder); }
    const cv = document.createElement('canvas'); cv.width = 1600; cv.height = 640; cv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#9cc3dd';
    document.body.appendChild(cv);
    const R = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.setClearColor(0x9cc3dd); if (T.SRGBColorSpace) { R.outputColorSpace = T.SRGBColorSpace; }
    const S = new T.Scene(); S.add(new T.HemisphereLight(0xffffff, 0x667755, 1.4)); const d = new T.DirectionalLight(0xffffff, 1.6); d.position.set(5, 10, 8); S.add(d);
    const C = new T.PerspectiveCamera(30, 1600 / 640, 0.1, 500); C.position.set(0, 14, 80); C.lookAt(0, 6, 0);
    const load = (u) => new Promise((ok) => L.load(u, (g) => ok(g.scene), undefined, () => ok(null)));
    const put = (o, x, y, h) => { if (!o) { return 0; } const b = new T.Box3().setFromObject(o), s = h / Math.max(1e-3, b.max.y - b.min.y); o.scale.setScalar(s); o.position.set(x - (b.min.x + b.max.x) / 2 * s, y - b.min.y * s, -(b.min.z + b.max.z) / 2 * s); S.add(o); return 1; };
    let n = 0; const W = 7.6;
    for (let i = 0; i < P.length; i++) {
      const x = (i - (P.length - 1) / 2) * W, k = Math.min(1, 6 / P[i][2]);
      n += put(await load('assets/models/fusion/' + P[i][0] + '.glb'), x, 9, P[i][2] * k);
      n += put(await load('../shared/assets/world3d/' + P[i][1] + '.glb'), x, 0, P[i][2] * k);
    }
    R.render(S, C); return n;
  }, PAIRS);
  await r.page.screenshot({ path: out + '/go_zp_lineup.png' });
  console.log(JSON.stringify({ loaded: res, of: PAIRS.length * 2, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
