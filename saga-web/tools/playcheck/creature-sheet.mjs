// node saga-web/tools/playcheck/creature-sheet.mjs [fish] → shots/creature_sheet.png (W-0178) · fish 면 물고기 △ 6 + ○ 7 → shots/creature_sheet_fish.png (W-0194)
// 빌린 짐승·괴물 3D(옛) ↔ 자체판 creatures3d(새)를 같은 자리·같은 빛으로 나란히 — 2나락 asset3d.rawScene 이 바꿔 끼우기(assets3d.creatureFor)를 그대로 탄다.
// 옛 쪽은 creatureFor 를 잠깐 null 로 바꿔 끼워 빌린 파일을 그대로 받는다. 키 1 로 맞추고 앞(+Z)에서 비스듬히 본다.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8918, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
const M = 'assets/models/';
const LIST = [   // [표시, 2나락 안 빌린 경로] — △ 12 전부 + ○ 표본 6
  ['stag △', 'animals_extra/Stag.glb'], ['husky △', 'animals/Husky.glb'], ['frog △', 'animals/Frog.glb'], ['worm △', 'animals_extra2/Worm.glb'],
  ['trex △', 'animals_extra2/T_Rex.glb'], ['triceratops △', 'animals_extra2/Triceratops.glb'], ['glub △', 'monsters/quaternius/Glub_f64d32a9.glb'],
  ['monkroose △', 'monsters/quaternius/Monkroose_54ca5c4d.glb'], ['dragon △', 'monsters/quaternius/Dragon_ae5b8510.glb'],
  ['ghost_skull △', 'monsters/quaternius/Ghost_Skull_0716bf8e.glb'], ['rat △', 'monsters/quaternius2/Rat.glb'], ['robot_walker △', 'monsters/robots/Robot_Walker.glb'],
  ['fox', 'animals_extra/Fox.glb'], ['cow', 'animals/Cow.glb'], ['shiba', 'animals/ShibaInu.glb'], ['raptor', 'monsters/quaternius_dino/Velociraptor.glb'],
  ['mushnub', 'monsters/quaternius/Mushnub_55c64684.glb'], ['robot_drone', 'monsters/robots/Robot_Drone.glb']
];
const FISH = [['betta △', 'animals_extra2/Betta.glb'], ['black_lionfish △', 'animals_extra2/Black_Lion_Fish.glb'], ['blue_goldfish △', 'animals_extra2/Blue_Goldfish.glb'],
  ['coral_grouper △', 'animals_extra2/Coral_Grouper.glb'], ['lionfish △', 'animals_extra2/Lionfish.glb'], ['dolphin △', 'animals_extra/Dolphin.glb'],
  ['anglerfish', 'animals_extra2/Anglerfish.glb'], ['koi', 'animals_extra2/Koi.glb'], ['shark(extra)', 'animals_extra/Shark.glb'], ['shark(extra2)', 'animals_extra2/Shark.glb'],
  ['manta_ray', 'animals_extra/MantaRay.glb'], ['fish_b', 'animals_extra/Fish2.glb'], ['swordfish', 'animals_extra2/Swordfish.glb']];
const IS_FISH = process.argv.includes('fish');
const LIST2 = (process.env.CS_LIST ? JSON.parse(process.env.CS_LIST) : IS_FISH ? FISH : LIST).map(([n, p]) => [n, M + p]);
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 240000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.go(`http://127.0.0.1:${PORT}/index.html`, 9000);
  const out = await c.ev(`(async function(){
    var T = THREE, A = DG.asset3d, AS = DG.assets3d, LIST = ${JSON.stringify(LIST2)}, real = AS.creatureFor;
    if (AS.probe) { AS.probe(); }
    for (var w = 0; w < 40 && !(AS.url && AS.url('creature', 'fox')); w++) { await new Promise(function (r) { setTimeout(r, 150); }); }
    function load(u, old) { return new Promise(function (res) { AS.creatureFor = old ? function () { return null; } : real; A.rawScene(u, function (s) { AS.creatureFor = real; res(s); }); setTimeout(function () { res(null); }, 20000); }); }
    var S = 240, cols = 6, rows = Math.ceil(LIST.length * 2 / cols), sheet = document.createElement('canvas');
    sheet.width = cols * S; sheet.height = rows * (S + 18); var g = sheet.getContext('2d'); g.fillStyle = '#20242a'; g.fillRect(0, 0, sheet.width, sheet.height);
    var R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(S, S); R.setClearColor(0x3a4048);
    var cam = new T.PerspectiveCamera(32, 1, 0.05, 50), log = [], k = 0;
    for (var i = 0; i < LIST.length; i++) {
      for (var old = 1; old >= 0; old--) {
        var sc = await load(LIST[i][1], !!old), scene = new T.Scene(), info = '';
        scene.add(new T.HemisphereLight(0xffffff, 0x445566, 1.4)); var dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 3, 2.5); scene.add(dl);
        if (sc) {
          var obj = sc, box = new T.Box3().setFromObject(obj), sz = box.getSize(new T.Vector3()), h = sz.y || 1, s = 1 / Math.max(h, sz.x * 0.6, sz.z * 0.6);
          obj.scale.multiplyScalar(s); box.setFromObject(obj); var ctr = box.getCenter(new T.Vector3());
          obj.position.x -= ctr.x; obj.position.z -= ctr.z; obj.position.y -= box.min.y; scene.add(obj);
          info = '키 ' + h.toFixed(2);
        } else { info = '못 받음'; }
        cam.position.set(1.15, 0.85, 1.9); cam.lookAt(0, 0.45, 0); R.render(scene, cam);
        var x = (k % cols) * S, y = Math.floor(k / cols) * (S + 18);
        g.drawImage(R.domElement, x, y + 18); g.fillStyle = old ? '#ffb0a0' : '#a0ffb8'; g.font = '13px sans-serif';
        g.fillText((old ? '옛 ' : '새 ') + LIST[i][0] + ' · ' + info, x + 4, y + 13);
        log.push((old ? '옛 ' : '새 ') + LIST[i][0] + ' ' + info); k++;
      }
    }
    return JSON.stringify({ png: sheet.toDataURL('image/png').split(',')[1], log: log });
  })()`);
  const r = JSON.parse(out);
  fs.writeFileSync(path.join(HERE, 'shots', IS_FISH ? 'creature_sheet_fish.png' : 'creature_sheet.png'), Buffer.from(r.png, 'base64'));
  console.log(r.log.join(' | '));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
