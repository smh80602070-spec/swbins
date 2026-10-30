"""K-0198 A자세 변주 고르기 — 인물마다 6장 중 팔이 몸에서 가장 잘 벌어진 것을 점수로 → _out/k198/apose_pick.json + 대조표(눈 확인용).
점수 = 팔 높이 줄(어깨~손목) 에서 바탕이 아닌 가로 폭이 원본보다 얼마나 넓어졌나(팔이 벌어지면 폭이 는다) ÷ 원본 폭. 마지막은 눈 확인."""
import glob, json, os
import numpy as np
from PIL import Image, ImageDraw
from k198_apose import W, H, BG, ROOT, OUT

def fg(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    return (np.abs(a - np.array(BG)).sum(2) > 45)

def mean_rgb(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float); m = (np.abs(a - np.array(BG)).sum(2) > 45)
    return a[m].mean(0) if m.any() else np.array(BG, float)

def main():
    d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'batches', 'k198_apose.json'), encoding='utf-8'))
    pick = {}; rows = []
    for it in d['items']:
        i = it['id'][:-6]
        j = json.load(open(os.path.join(OUT, f'{i}_front', 'joints.json'), encoding='utf-8'))
        st = Image.open(os.path.join(ROOT, 'saga-assets', 'illust', 'shared', i, 'stand.webp'))
        sc = 0.9 * H / st.height; oy = (H - int(st.height * sc)) // 2
        y0 = int(j['N']['sh'][1] * sc + oy); y1 = int(j['N']['wr'][1] * sc + oy)
        o = fg(os.path.join(OUT, 'apose_src', f'{i}.png'))[y0:y1]
        ow = np.maximum(1, o.sum(1)).mean()
        best = None; om = mean_rgb(os.path.join(OUT, 'apose_src', f'{i}.png'))
        for f in sorted(glob.glob(os.path.join(OUT, 'apose', f'{i}_apose_v0*.png'))):
            g = fg(f)[y0:y1]
            ext = np.array([ (np.where(r)[0].max() - np.where(r)[0].min()) if r.any() else 0 for r in g]).mean()
            oext = np.array([ (np.where(r)[0].max() - np.where(r)[0].min()) if r.any() else 0 for r in o]).mean()
            sco = (ext - oext) / max(1, oext) - 2.5 * (np.abs(mean_rgb(f) - om).sum() / 255.0)   # 옷 색 쏠림 감점(옆·뒷모습과 같은 사람으로 보이게)
            if best is None or sco > best[0]: best = (sco, f)
        pick[i] = {'file': os.path.basename(best[1]), 'score': round(best[0], 3)}
    json.dump(pick, open(os.path.join(OUT, 'apose_pick.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ids = sorted(pick); w, h = 190, 304
    for part in range(0, len(ids), 15):
        sub = ids[part:part + 15]; sh = Image.new('RGB', (w * 5, h * 3), '#222')
        for n, i in enumerate(sub):
            im = Image.open(os.path.join(OUT, 'apose', pick[i]['file'])).convert('RGB').resize((w, h)); sh.paste(im, ((n % 5) * w, (n // 5) * h))
            ImageDraw.Draw(sh).text(((n % 5) * w + 3, (n // 5) * h + 3), f"{i} {pick[i]['file'][-7:-4]} {pick[i]['score']}", fill='red')
        sh.save(os.path.join(OUT, f'apose_picks_{part // 15 + 1}.jpg'), quality=82)
    print('APOSE_PICK', len(pick))

if __name__ == '__main__':
    main()
