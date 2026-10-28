// W-0445 컷아웃 동작 팩(K-0199) 옛·새 시트 — 한 인물(기본 eu_caesar)을 동작마다 위상 다섯 칸으로. 위 줄 = 팩 끔(cutout2d.pack 0), 아래 줄 = 팩.
//   node cutout-pack-sheet.mjs [저장 폴더] [풀] [동작,…]   (서버 :8871 — PW_BASE 로 바꿀 수 있다)
//   동작 기본 walk,run,idle,attack:sword,attack:spear,hit,death · 「이름:무기」는 o.weapon
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.', POOL = process.argv[3] || 'eu_caesar';
const CLIPS = (process.argv[4] || 'walk,run,idle,attack:sword,attack:spear,hit,death').split(',');
const r = await open('saga-story', { w: 1500, h: 140 * CLIPS.length + 40 });
try {
  await r.page.goto(r.url('index.html')); await sleep(5000);
  await r.page.evaluate((a) => { const C = DG.cutout2d; C.drawFor(document.createElement('canvas').getContext('2d'), { pool: a, x: 0, y: 0, clip: 'idle', t: 0 }, 60); C.packClips(); }, POOL);
  for (let i = 0; i < 20 && !(await r.page.evaluate((a) => DG.cutout2d.has(a) && !!DG.cutout2d.packClips(), POOL)); i++) { await sleep(500); }
  const info = await r.page.evaluate(({ pool, clips }) => {
    const C = DG.cutout2d, cv = document.createElement('canvas'), W = 1500, H = 140 * clips.length + 40; cv.width = W; cv.height = H;
    cv.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#e9e2d4'; document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.fillStyle = '#e9e2d4'; g.fillRect(0, 0, W, H); g.font = '600 13px sans-serif'; g.fillStyle = '#333';
    const used = []; DG.core.setTune('cutout2d.blend', 0);   // 같은 key 로 연달아 그려 크로스페이드가 직전 자세에 붙는다 — 시트는 끈다
    clips.forEach((cw, row) => {
      const [clip, wpn] = cw.split(':'), y0 = 30 + row * 140;
      g.fillStyle = '#333'; g.fillText(cw, 8, y0 + 14);
      [0, 1].forEach((pk) => {
        DG.core.setTune('cutout2d.pack', pk);
        for (let i = 0; i < 5; i++) {
          const ph = i / 5, x = 140 + pk * 680 + i * 130, isWalk = clip === 'walk';
          C.drawFor(g, { pool: pool, x: x, y: y0 + 120, clip: clip, weapon: wpn, t: isWalk ? ph + 1e-3 : ph * (clip === 'idle' || clip === 'run' ? 1000 : 1400), facing: 1 }, 100);
        }
        if (pk) { used.push(cw + '→' + C.nameOf(null, clip, wpn)); }
      });
    });
    g.fillStyle = '#a33'; g.fillText('팩 끔(옛)', 140, 20); g.fillText('팩(K-0199)', 820, 20);
    DG.core.setTune('cutout2d.pack', 1);
    return { used, pack: !!C.packClips() };
  }, { pool: POOL, clips: CLIPS });
  await r.page.screenshot({ path: out + '/cutout_pack_' + POOL + '.png' });
  console.log(JSON.stringify({ info, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
