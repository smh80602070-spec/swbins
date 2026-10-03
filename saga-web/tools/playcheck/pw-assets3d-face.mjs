// 통일 3D 영웅 몸의 정면이 +Z 인지·재질 종류가 무엇인지 잰다(W-0021) — 스크린샷 없음
//   node pw-assets3d-face.mjs <판 폴더>
// 영웅 표본 둘을 세워 얼굴 메시(눈동자·얼굴 피부)의 가운데 z 가 몸 전체 가운데 z 보다 앞(+)인지 본다. 다섯 판의 배우는 +Z 가 앞이라는 가정으로 돌려 세운다.
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const game = process.argv[2] || 'saga-go';
const r = await open(game);
await r.page.goto(r.url('index.html')); await sleep(1500);
const out = await r.page.evaluate(async () => {
  const A = window.DG.assets3d, T = window.THREE;
  await new Promise((ok) => A.whenSettled(ok));
  const heroes = window.DG.data.heroes.filter((x) => A.has('hero', x.id)).slice(0, 2);
  const res = [];
  for (const hero of heroes) {
    const shell = window.DG.asset3d.build('hero', hero, null);
    for (let i = 0; i < 100 && shell.userData.assetState !== 'glb'; i++) { await new Promise((ok) => setTimeout(ok, 250)); }
    shell.updateMatrixWorld(true);
    let eye = null, mats = {};
    const whole = new T.Box3().setFromObject(shell);
    shell.traverse((o) => {
      if (!o.isMesh) { return; }
      const n = (o.material && o.material.name) || '', t = o.material && o.material.type;
      mats[t] = (mats[t] || 0) + 1;
      if (/EyeIris|Face_00_SKIN/.test(n) && !eye) { eye = new T.Box3().setFromObject(o); }
    });
    const ez = eye ? eye.getCenter(new T.Vector3()).z : null, wz = whole.getCenter(new T.Vector3()).z;
    res.push({ id: hero.id, state: shell.userData.assetState, faceZ_minus_bodyZ: ez === null ? null : +(ez - wz).toFixed(3), depth: +(whole.max.z - whole.min.z).toFixed(3), mats, vrmFrontGroup: !!shell.getObjectByName('vrmFront') });
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await r.close();
