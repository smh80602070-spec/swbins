"""K-0173 — 유니티 UI 스킨 스프라이트 .meta 를 직접 쓴다(9-slice 테두리 포함). 유니티 배치로 만들면 기본 텍스처 메타라 테두리가 0 이다.

  py tools/asset-place/unity_sprite_meta.py [--check]
      saga-unity/Assets/SagaCore/Resources/UI/<판>/<부품>.png 마다 <부품>.png.meta
      테두리 = saga-assets/ui/ui_parts.json 의 slice(숫자 n → 네 변 n · "x14" → 왼·오른만 14 · null → 0)

설정: Sprite(2D and UI) · Single · Full Rect(Sliced 필수) · 밉맵 끔 · Bilinear · Clamp · 압축 없음 · alpha 투명 · 100 px/unit.
guid·spriteID 는 경로 md5(다시 돌려도 같은 값 — 유니티 참조가 안 깨짐). 이미 있는 .meta 는 guid 를 그대로 두고 설정만 다시 쓴다.
"""
import hashlib
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DST = os.path.join(ROOT, 'saga-unity', 'Assets', 'SagaCore', 'Resources', 'UI')
PARTS = os.path.join(ROOT, 'saga-assets', 'ui', 'ui_parts.json')

PLATFORM = """  - serializedVersion: 4
    buildTarget: {t}
    maxTextureSize: 2048
    resizeAlgorithm: 0
    textureFormat: -1
    textureCompression: 0
    compressionQuality: 50
    crunchedCompression: 0
    allowsAlphaSplitting: 0
    overridden: 0
    ignorePlatformSupport: 0
    androidETC2FallbackOverride: 0
    forceMaximumCompressionQuality_BC6H_BC7: 0
"""

META = """fileFormatVersion: 2
guid: {guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {{}}
  serializedVersion: 13
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
    flipGreenChannel: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMipmapLimit: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: 1
  spriteExtrude: 1
  spriteMeshType: 0
  alignment: 0
  spritePivot: {{x: 0.5, y: 0.5}}
  spritePixelsToUnits: 100
  spriteBorder: {{x: {l}, y: {b}, z: {r}, w: {t}}}
  spriteGenerateFallbackPhysicsShape: 0
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 8
  textureShape: 1
  singleChannelComponent: 0
  flipbookRows: 1
  flipbookColumns: 1
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
  ignorePngGamma: 0
  applyGammaDecoding: 0
  swizzle: 50462976
  cookieLightType: 0
  platformSettings:
{platforms}  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    customData:
    physicsShape: []
    bones: []
    spriteID: {sid}
    internalID: 21300000
    vertices: []
    indices:
    edges: []
    weights: []
    secondaryTextures: []
    spriteCustomMetadata:
      entries: []
    nameFileIdTable: {{}}
  mipmapLimitGroupName:
  pSDRemoveMatte: 0
  userData:
  assetBundleName:
  assetBundleVariant:
"""


def border(slice_):
    if slice_ is None:
        return 0, 0, 0, 0
    if isinstance(slice_, str) and slice_.startswith('x'):
        n = int(slice_[1:])
        return n, 0, n, 0
    n = int(slice_)
    return n, n, n, n


def main(check):
    parts = json.load(open(PARTS, encoding='utf-8'))['parts']
    n = bad = 0
    for game in sorted(os.listdir(DST)) if os.path.isdir(DST) else []:
        gd = os.path.join(DST, game)
        if not os.path.isdir(gd):
            continue
        for f in sorted(os.listdir(gd)):
            if not f.endswith('.png') or f[:-4] not in parts:
                continue
            l, b, r, t = border(parts[f[:-4]]['slice'])
            mp = os.path.join(gd, f + '.meta')
            rel = os.path.relpath(os.path.join(gd, f), ROOT).replace('\\', '/')
            guid = hashlib.md5(rel.encode()).hexdigest()
            if os.path.exists(mp):
                m = re.search(r'^guid: ([0-9a-f]{32})', open(mp, encoding='utf-8').read(), re.M)
                guid = m.group(1) if m else guid
            text = META.format(guid=guid, l=l, b=b, r=r, t=t, sid=hashlib.md5(('sprite:' + rel).encode()).hexdigest(),
                               platforms=''.join(PLATFORM.format(t=x) for x in ('DefaultTexturePlatform', 'Standalone', 'Android', 'iOS')))
            n += 1
            if check:
                cur = open(mp, encoding='utf-8').read() if os.path.exists(mp) else ''
                want = 'spriteBorder: {x: %d, y: %d, z: %d, w: %d}' % (l, b, r, t)
                if want not in cur or 'textureType: 8' not in cur or 'spriteMeshType: 0' not in cur:
                    bad += 1
                    print('다름', rel)
            else:
                open(mp, 'w', encoding='utf-8', newline='\n').write(text)
    print('UI_META %s %d' % ('어긋남 %d /' % bad if check else '씀', n))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv))
