"""공방 몸 텍스처 중복 합치기 — `Assets/Art/CharactersForge/Textures/` 에서 **내용이 완전히 같고 가져오기 설정도 같은** 그림을 하나로 합친다.
화질은 그대로다(같은 그림을 여러 번 싣던 낭비만 없앤다). 인물 105 를 켜면서 눈 그림 106(서로 다른 것 7)·옷 노멀(색만 다른 변형마다 같은 그림) 등이 겹쳐 실렸다.

  py saga-unity/tools/dedupe_forge_textures.py            # 드라이런(기본) — 몇 개·몇 MB 줄어드는지만 본다
  py saga-unity/tools/dedupe_forge_textures.py --apply    # 합친다: .mat 의 guid 를 대표 그림으로 바꾸고 겹치는 png·.meta 를 지운다

Unity 를 끈 채로 돌린다. 텍스처·재질은 저장소 밖(.gitignore)이라 커밋할 것은 없다. `SetupForgeHeroes`·`SetupForgeImport` 를 다시 돌리면 그림이 다시 생기니 그 뒤에 다시 돌린다.
같은 묶음 조건: 파일 내용 md5 + `.meta` 의 textureType·sRGBTexture·maxTextureSize·compression 설정. 대표 = 이름 순 첫 번째.
"""
import collections
import glob
import hashlib
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Assets', 'Art', 'CharactersForge')
TEX = os.path.join(ROOT, 'Textures')


def md5(p):
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()


def meta_key(meta):
    t = open(meta, encoding='utf-8', errors='replace').read()
    keys = ('textureType', 'sRGBTexture', 'maxTextureSize', 'textureCompression', 'compressionQuality', 'alphaIsTransparency', 'enableMipMap')
    return tuple(re.search(rf'^\s*{k}: (\S+)', t, re.M).group(1) if re.search(rf'^\s*{k}: (\S+)', t, re.M) else '' for k in keys), \
        re.search(r'^guid: ([0-9a-f]+)', t, re.M).group(1)


def main():
    apply = '--apply' in sys.argv
    groups = collections.defaultdict(list)
    for p in sorted(glob.glob(os.path.join(TEX, '*.png'))):
        meta = p + '.meta'
        if not os.path.exists(meta):
            continue
        mk, guid = meta_key(meta)
        groups[(md5(p), mk)].append((p, guid))
    dup_bytes = dup_files = 0
    remap = {}     # 겹친 guid → 대표 guid
    drop = []
    for members in groups.values():
        if len(members) < 2:
            continue
        keep = members[0]
        for p, g in members[1:]:
            remap[g] = keep[1]
            drop.append(p)
            dup_bytes += os.path.getsize(p)
            dup_files += 1
    print(f'그림 {sum(len(v) for v in groups.values())}개 · 서로 다른 묶음 {len(groups)} · 겹침 {dup_files}개 = {dup_bytes // 2**20} MB')
    if not apply:
        print('(드라이런 — --apply 로 합친다)')
        return 0
    changed = 0
    if remap:
        pat = re.compile('|'.join(re.escape(g) for g in remap))
        for ext in ('mat', 'prefab', 'asset', 'controller'):
            for f in glob.glob(os.path.join(ROOT, '**', '*.' + ext), recursive=True):
                raw = open(f, 'rb').read()
                try:
                    txt = raw.decode('utf-8')
                except UnicodeDecodeError:
                    continue
                new = pat.sub(lambda m: remap[m.group(0)], txt)
                if new != txt:
                    open(f, 'wb').write(new.encode('utf-8'))
                    changed += 1
    for p in drop:
        os.remove(p)
        os.remove(p + '.meta')
    print(f'합침: 참조 바꾼 파일 {changed}개 · 지운 그림 {dup_files}개 ({dup_bytes // 2**20} MB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
