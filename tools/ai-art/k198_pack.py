"""K-0198 ⑤ 정면 컷아웃 놓기 — _out/k198/<id>_front/rig → saga-assets/web2d/cutout/<id>~front/ · index.json 에 "dirs": {"<id>": ["side","front"]}.
  py tools/ai-art/k198_pack.py [front|back]   # _out/k198/*_front/rig/rig.json 전부
  그 뒤 py tools/asset-place/place.py web2d-cutout (웹 shared 로 복사) — 엔진이 ~front 를 읽는 건 웹 W 줄."""
import glob, json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CUT = os.path.join(ROOT, 'saga-assets', 'web2d', 'cutout')
IDX = os.path.join(CUT, 'index.json')
idx = json.load(open(IDX, encoding='utf-8'))
dirs = idx.setdefault('dirs', {})
VIEW = sys.argv[1] if len(sys.argv) > 1 else 'front'   # front | back
for rd in sorted(glob.glob(os.path.join(ROOT, 'tools', 'ai-art', '_out', 'k198', '*_' + VIEW, 'rig'))):
    pid = os.path.basename(os.path.dirname(rd))[:-(len(VIEW) + 1)]
    if not os.path.exists(os.path.join(rd, 'rig.json')):
        continue
    out = os.path.join(CUT, pid + '~' + VIEW)
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(rd, out, ignore=shutil.ignore_patterns('_*'))
    lp = os.path.join(ROOT, 'saga-assets', 'illust', 'shared', pid, pid + '.license.json')   # 정면 일러스트(K-0178·0183·0185)의 모델·라이선스를 이어받는다
    src = json.load(open(lp, encoding='utf-8')) if os.path.exists(lp) else {}
    lic = json.load(open(os.path.join(out, 'rig.license.json'), encoding='utf-8'))
    lic.update({'id': 'cutout_' + pid + '_' + VIEW, 'ticket': 'K-0198', 'generator': src.get('generator'), 'model': src.get('model'), 'model_license': src.get('model_license'),
                'commercial_use': src.get('commercial_use'), 'license': src.get('license'), 'note': src.get('note'),
                'from': ('saga-assets/illust/shared/%s/stand.webp' % pid) if VIEW == 'front' else 'tools/ai-art/_out/k198/%s_back/back.png (K-0198 뒷모습 일러스트, 정면 stand.webp 외형 참조)' % pid, 'packed_by': 'K-0198 tools/ai-art/k198_front.sh + k198_pack.py'})
    json.dump(lic, open(os.path.join(out, 'rig.license.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    dirs[pid] = sorted(set(dirs.get(pid, ['side'])) | {VIEW}, key=['side', 'front', 'back'].index)
    print('놓음', pid)
json.dump(idx, open(IDX, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
