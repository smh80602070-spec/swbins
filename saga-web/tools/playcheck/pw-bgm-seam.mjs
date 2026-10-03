// 배경음 곡의 길이·소리 크기·루프 이음매를 숫자로 잰다(W-0020 2부 판단 근거) — 소리를 틀지 않고 디코드만 한다
//   node pw-bgm-seam.mjs <판 폴더> <곡 주소…>        예) node pw-bgm-seam.mjs saga-story ../shared/audio/bgm/story-town.ogg assets/audio/bgm/town.mp3
// 곡마다: 길이(초)·전체 RMS(dBFS)·처음/끝 0.5초 RMS 차(dB, 클수록 이음매에서 크기가 튄다)·마지막↔처음 표본 차(0~2, 클수록 딱 소리).
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
import { open, sleep } from './pw.mjs';

const [game, ...tracks] = process.argv.slice(2);
if (!game || !tracks.length) { console.log('사용: node pw-bgm-seam.mjs saga-story <주소…>'); process.exit(1); }
const r = await open(game);
await r.page.goto(r.url('index.html')); await sleep(1000);
const out = await r.page.evaluate(async (list) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const rows = [];
  const db = (x) => (x > 1e-9 ? +(20 * Math.log10(x)).toFixed(1) : -99);
  for (const u of list) {
    try {
      const buf = await (await fetch(u)).arrayBuffer();
      const a = await ctx.decodeAudioData(buf), n = a.length, sr = a.sampleRate, ch = a.getChannelData(0), ch1 = a.numberOfChannels > 1 ? a.getChannelData(1) : ch;
      const rms = (from, to) => { let s = 0; for (let i = from; i < to; i++) { const v = (ch[i] + ch1[i]) / 2; s += v * v; } return Math.sqrt(s / Math.max(1, to - from)); };
      const w = Math.floor(sr * 0.5);
      const head = rms(0, w), tail = rms(n - w, n), all = rms(0, n);
      let peak = 0; for (let i = 0; i < n; i += 7) { const v = Math.abs(ch[i]); if (v > peak) { peak = v; } }
      const jump = Math.abs((ch[n - 1] + ch1[n - 1]) / 2 - (ch[0] + ch1[0]) / 2);
      rows.push({ track: u.split('/').pop(), sec: +(n / sr).toFixed(1), rmsDb: db(all), peakDb: db(peak), headTailDb: +Math.abs(db(head) - db(tail)).toFixed(1), seamJump: +jump.toFixed(3) });
    } catch (e) { rows.push({ track: u, error: String(e.message || e).slice(0, 60) }); }
  }
  return rows;
}, tracks);
console.log(JSON.stringify(out, null, 1));
await r.close();
