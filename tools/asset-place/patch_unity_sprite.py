"""Unity UI 아이콘용 .meta 고치기(K-0035) — 기본값(Texture, mipmap 켬)을 Sprite(2D and UI)·mipmap 끔·알파 투명으로.
  py tools/asset-place/patch_unity_sprite.py saga-unity/Assets/SagaCore/Resources/Icons     # 아래의 *.png.meta 전부, 멱등
UI Image 에 쓰는 그림은 Resources.Load<Sprite> 로 불러야 해서 textureType 이 Sprite 여야 한다. 엔진이 새 .meta 를 만든 직후에 한 번 돌린다.
"""
import os
import sys

root = os.path.abspath(sys.argv[1])
n = 0
for dp, _, fns in os.walk(root):
    for fn in fns:
        if not fn.endswith('.png.meta'):
            continue
        p = os.path.join(dp, fn)
        s = open(p, 'rb').read()
        t = s.replace(b'  enableMipMap: 1', b'  enableMipMap: 0').replace(b'  spriteMode: 0', b'  spriteMode: 1') \
              .replace(b'  alphaIsTransparency: 0', b'  alphaIsTransparency: 1').replace(b'  textureType: 0', b'  textureType: 8')
        if t != s:
            open(p, 'wb').write(t)
            n += 1
print('고친 .meta', n)
