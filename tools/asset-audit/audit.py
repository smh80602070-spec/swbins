#!/usr/bin/env python3
"""
세 트랙(웹 다섯 판 · saga-godot · saga-unity) 에셋 점검 — 읽기만 한다, 아무것도 고치지 않는다.

    py tools/asset-audit/audit.py                 # 전부, 요약 + out/report.html + out/report.json
    py tools/asset-audit/audit.py --track web     # web | godot | unity (여러 번 가능)
    py tools/asset-audit/audit.py --game saga-go  # 웹 한 판만
    py tools/asset-audit/audit.py --strict        # 🔴 가 하나라도 있으면 종료 코드 1 (precheck 연결용)

잡는 것(심각도 순):
  🔴 public    공개 저장소에 들어가면 안 되는 에셋이 git 에 올라감(.gitignore 우회 강제 add, Mixamo 등 재배포 금지 폴더)
  🔴 decoder   웹 판 GLB 가 Meshopt/Draco/KTX2 로 압축됐는데 그 판 js 가 해당 디코더를 안 붙임 → 로드 실패
  🔴 gitsize   git 에 올라간 파일이 100MB 초과(GitHub 거부) · 🟡 50MB 초과(경고)
  🟡 pair      Unity .meta 짝 없음/고아 .meta · Godot .import 짝 없음
  🟡 heavy     웹 GLB >5MB · 삼각형 >50k · 텍스처 한 변 >2048 (폰 기준)
  🟡 license   출처 문서(ASSET_LICENSES.md / ASSET_GUIDE.md)에 폴더·파일 이름이 한 번도 안 나옴
  ⚪ unref     코드·씬 어디에도 파일 이름 흔적 없음(동적 경로일 수 있어 참고용)
  ⚪ dup       같은 내용(md5) 사본 — 트랙을 넘나드는 것은 공용 에셋 통합 후보
출력은 tools/asset-audit/out/ (gitignore) — 저장소에 결과물을 남기지 않는다.
"""
import argparse, hashlib, json, os, re, struct, subprocess, sys, time
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
WEB_GAMES = ['saga-go', 'saga-dungeon', 'saga-forest', 'saga-story', 'saga-realm']

MODEL = {'.glb', '.gltf', '.fbx', '.obj', '.vrm', '.blend'}
IMAGE = {'.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.tga', '.psd', '.hdr', '.exr'}
AUDIO = {'.ogg', '.mp3', '.wav', '.m4a', '.flac'}
ASSET_EXT = MODEL | IMAGE | AUDIO

# 재배포 금지로 알려진 폴더 — .gitignore 가 막고 있지만, 강제 add 되면 여기서 잡는다
RESTRICTED = [r'(^|/)_mixamo_src/', r'(^|/)characters_vroid/anim/', r'(^|/)CharactersRealistic/',
              r'(^|/)people/realistic/', r'mixamo']
# 출처 문서 대조 때 무시하는 흔한 폴더 이름
GENERIC = {'assets', 'models', 'textures', 'texture', 'audio', 'sfx', 'bgm', 'sprites', 'sprites2d', 'art',
           'props', 'nature', 'people', 'animals', 'buildings', 'anim', 'regular', 'hdri', 'portraits',
           'portrait', 'hero', 'pet', 'land', 'generated', 'environment', 'characters', 'dungeon', 'rocks',
           'vegetation', 'shrine', 'materials', 'prefabs', 'resources', 'games', 'data', 'ui', 'icons'}
# 우리 도구가 구운 것 — 출처 문서 대조에서 뺀다(asset-forge → generated/, bake-portraits → portraits/)
SELF_MADE = ['/generated/', '/portraits/']
BUDGET = {'glb_mb': 5, 'tris': 50000, 'tex_px': 2048}
PEOPLE_TRIS = 65000   # 뼈 있는 사람 몸(VRoid 등 `/people/`·characters_vroid)은 줄이면 관절이 틀어져 예외 허용치(사용자 2026-10-02, K-0016 A)
# 인물·동작 출처(char-forge README §7 단계 5 "상용 문턱") — Mixamo 는 재배포 금지·Adobe 약관 의존이라 게임이 쓰면 🔴.
# VRoid 는 D4(09-25)로 godot 몸 정본이라 VRM 메타의 상업·재배포 허가로 판정한다. 공방(char-forge) 몸은 옆에 *.license.json(CC0) 필수.
MIXAMO = RESTRICTED
FORGE = [r'(^|/)CharactersForge/[^/]+\.fbx$', r'(^|/)characters_cf/[^/]+\.glb$']
ANIM_EXT = {'.res', '.anim'}  # 구운 동작(Godot AnimationLibrary·Unity 클립) — ASSET_EXT 밖이라 출처만 본다
SEV = {'public': 3, 'decoder': 3, 'gitsize': 3, 'origin': 3, 'pair': 2, 'heavy': 2, 'license': 2, 'origin_local': 2, 'origin_left': 2,
       'unref': 1, 'dup': 1}
SEV_ICON = {3: '🔴', 2: '🟡', 1: '⚪'}


def rel(p):
    return os.path.relpath(p, ROOT).replace('\\', '/')


def walk(base, skip=()):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in skip and not d.startswith('.')]
        for f in fns:
            yield os.path.join(dp, f)


def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def git(*args):
    try:
        r = subprocess.run(['git', '-C', ROOT, *args], capture_output=True, check=True)
        return r.stdout.decode('utf-8', 'replace')
    except Exception:
        return ''


# ---------- 파일 속 들여다보기 ----------

def image_dims_bytes(b):
    """PNG/JPEG/WebP 머리만 읽어 (w, h). 모르면 None."""
    if b[:8] == b'\x89PNG\r\n\x1a\n' and len(b) >= 24:
        return struct.unpack('>II', b[16:24])
    if b[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(b):
            if b[i] != 0xFF:
                i += 1; continue
            m = b[i + 1]
            if m in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', b[i + 5:i + 9]); return (w, h)
            i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        c = b[12:16]
        if c == b'VP8 ' and len(b) >= 30:
            w, h = struct.unpack('<HH', b[26:30]); return (w & 0x3FFF, h & 0x3FFF)
        if c == b'VP8L' and len(b) >= 25:
            v = int.from_bytes(b[21:25], 'little'); return ((v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1)
        if c == b'VP8X' and len(b) >= 30:
            return (int.from_bytes(b[24:27], 'little') + 1, int.from_bytes(b[27:30], 'little') + 1)
    return None


def image_dims(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(1 << 16)
        return image_dims_bytes(head)
    except OSError:
        return None


def glb_info(path):
    """GLB 의 JSON 청크만 풀어 삼각형·텍스처·애니·확장을 센다(메시 전체를 올리지 않는다)."""
    try:
        with open(path, 'rb') as f:
            data = f.read()
        if data[:4] != b'glTF':
            return {'err': 'GLB 머리 아님'}
        jlen = struct.unpack('<I', data[12:16])[0]
        g = json.loads(data[20:20 + jlen].decode('utf-8'))
        binoff = 20 + jlen + 8
    except Exception as e:
        return {'err': f'읽기 실패: {e.__class__.__name__}'}
    acc = g.get('accessors', [])
    tris = 0
    for m in g.get('meshes', []):
        for p in m.get('primitives', []):
            if p.get('mode', 4) != 4:
                continue
            if 'indices' in p and p['indices'] < len(acc):
                tris += acc[p['indices']].get('count', 0) // 3
            else:
                pos = p.get('attributes', {}).get('POSITION')
                if pos is not None and pos < len(acc):
                    tris += acc[pos].get('count', 0) // 3
    maxpx = 0
    bvs = g.get('bufferViews', [])
    for im in g.get('images', []):
        bv = im.get('bufferView')
        if bv is not None and bv < len(bvs):
            o = binoff + bvs[bv].get('byteOffset', 0)
            d = image_dims_bytes(data[o:o + 4096])
            if d:
                maxpx = max(maxpx, *d)
    ext = sorted(set(g.get('extensionsUsed', [])))
    return {'tris': tris, 'meshes': len(g.get('meshes', [])), 'images': len(g.get('images', [])),
            'maxpx': maxpx, 'anims': len(g.get('animations', [])), 'skins': len(g.get('skins', [])),
            'gltf_ext': ext}


def vrm_meta(path):
    """VRM(0.x `VRM.meta` · 1.0 `VRMC_vrm.meta`) 라이선스 칸 → (상업 허가, 재배포 허가, 표기 필요, 요약)."""
    try:
        with open(path, 'rb') as f:
            data = f.read()
        g = json.loads(data[20:20 + struct.unpack('<I', data[12:16])[0]].decode('utf-8'))
    except Exception:
        return None
    e = g.get('extensions', {})
    if 'VRMC_vrm' in e:
        m = e['VRMC_vrm'].get('meta', {})
        com = m.get('commercialUsage', 'personalNonProfit') in ('personalProfit', 'corporation')
        red = bool(m.get('allowRedistribution', False))
        cred = m.get('creditNotation', 'required') == 'required'
        return com, red, cred, f"VRM1 상업 {m.get('commercialUsage')} · 재배포 {red} · 표기 {m.get('creditNotation', 'required')}"
    if 'VRM' in e:
        m = e['VRM'].get('meta', {})
        lic = m.get('licenseName', '')
        com = m.get('commercialUssageName') == 'Allow'
        red = lic not in ('Redistribution_Prohibited', 'Other', '')
        cred = lic.startswith('CC_BY')
        return com, red, cred, f"VRM0 {lic} · 상업 {m.get('commercialUssageName')}"
    return None


def mixamo_ref(rp, p, kind, gcode):
    """Mixamo 파일을 게임(도구 폴더 밖 코드·씬)이 쓰나 — `attack`·`idle` 같은 줄기 이름은 어디에나 있어 안 본다.
    경로(에셋 폴더 안쪽)·파일 이름 전체·Unity GUID·따옴표 낀 몸 폴더 이름(`"Racer"` — NowRoot + key + ".fbx" 식 조립)만 본다."""
    inner = rp.split('/Assets/' if kind == 'unity' else '/assets/', 1)[-1]
    base = os.path.basename(p)
    if inner in gcode:
        return True
    if kind == 'godot':  # godot 은 anim_cc0/ 에 같은 이름의 CC0 판이 있다 — 경로로만 본다
        return False
    if base in gcode:
        return True
    if kind == 'unity':
        if os.path.exists(p + '.meta'):
            m = re.search(r'guid:\s*([0-9a-f]{32})', read(p + '.meta'))
            if m and m.group(1) in gcode:
                return True
        folder = rp.split('/')[-2]
        return folder not in ('CharactersRealistic', 'Textures') and ('"' + folder + '"') in gcode
    return False


def origin(rp, p, ext, pathset, ref):
    """인물·동작 출처 판정 → (kind, msg) 또는 None. Mixamo 는 ref 에 mixamo_ref 결과를 넘긴다."""
    if any(re.search(r, rp, re.I) for r in MIXAMO):
        if ref:  # D5(2026-09-26): Mixamo 는 게임에 넣어 팔기 OK·재배포 금지 → 로컬 전용이면 허용(공개 저장소에 오르면 'public' 🔴)
            return 'origin_local', 'Mixamo 로컬 전용(D5 허용 — 게임 판매 OK·재배포 금지) — 다른 PC 는 다시 받는다(tools/mixamo_automation)'
        return 'origin_left', 'Mixamo 출처 파일이 남아 있다(안 씀) — 교체가 끝났으면 지워도 된다'
    # 옆 .vrm 사본이 없어도(용량 때문에 새 몸은 .glb 만 커밋) characters_vroid 의 .glb 는 자기 안의 VRM 메타로 본다
    sib = os.path.splitext(p)[0] + '.vrm'
    if ext == '.vrm' or (ext == '.glb' and (sib in pathset or re.search(r'(^|/)characters_vroid/[^/]+\.glb$', rp))):
        v = vrm_meta(p if ext == '.vrm' or sib not in pathset else sib)
        if v is None:
            return 'origin', 'VRoid 몸인데 VRM 라이선스 칸을 못 읽는다'
        com, red, cred, why = v
        if not (com and red):
            return 'origin', f'VRoid 몸 라이선스가 상업·재배포를 막는다({why}) — VRoid Studio 에서 허가로 다시 내보낸다'
        if cred:
            return 'origin_left', f'VRoid 몸 — 저작자 표시가 필요한 라이선스({why}). 우리가 만든 몸이면 표기 불요로 다시 내보낸다'
        return None
    if any(re.search(r, rp) for r in FORGE):
        lic = os.path.splitext(p)[0] + '.license.json'
        if lic not in pathset:
            return 'origin', '공방 몸인데 옆에 *.license.json 이 없다 — 입력 출처를 모른다(char-forge 원칙 2)'
        try:
            txt = json.load(open(lic, encoding='utf-8')).get('license', '')
        except Exception:
            txt = ''
        if not str(txt).startswith('CC0'):
            return 'origin', f'공방 몸 license.json 이 CC0 가 아니다: {str(txt)[:60]}'
    return None


# ---------- 트랙 정의 ----------

def tracks(sel, game):
    out = []
    if 'web' in sel:
        for gm in WEB_GAMES:
            if game and gm != game:
                continue
            base = os.path.join(ROOT, 'saga-web', gm)
            out.append({'id': f'web:{gm}', 'kind': 'web', 'asset_dir': os.path.join(base, 'assets'),
                        'code_dirs': [base], 'code_skip': {'node_modules', 'dist', 'mobile', 'server', '_wip'},
                        'code_ext': {'.js', '.html', '.json', '.css', '.mjs', '.gltf'},
                        'docs': [os.path.join(base, 'assets', 'ASSET_LICENSES.md'),
                                 os.path.join(base, 'assets', 'ASSET_CATALOG.md')]})
    if 'godot' in sel and not game:
        base = os.path.join(ROOT, 'saga-godot')
        out.append({'id': 'godot', 'kind': 'godot', 'asset_dir': os.path.join(base, 'assets'),
                    'code_dirs': [base], 'code_skip': {'builds', '_mixamo_src'},
                    'code_ext': {'.tscn', '.tres', '.gd', '.gdshader', '.cfg', '.json', '.godot', '.gltf'},
                    'docs': [os.path.join(base, 'docs', 'ASSET_GUIDE.md')]})
    if 'unity' in sel and not game:
        base = os.path.join(ROOT, 'saga-unity')
        out.append({'id': 'unity', 'kind': 'unity', 'asset_dir': os.path.join(base, 'Assets'),
                    'code_dirs': [os.path.join(base, 'Assets')], 'code_skip': set(),
                    'code_ext': {'.cs', '.unity', '.prefab', '.asset', '.mat', '.controller', '.anim',
                                 '.overrideController', '.json', '.gltf', '.shadergraph', '.shader', '.playable',
                                 '.lighting', '.mask', '.signal', '.spriteatlas', '.spriteatlasv2', '.mixer'},
                    'docs': [os.path.join(base, 'docs', 'ASSET_GUIDE.md')]})
    return out


# 게임 밖 도구(킷배싱·굽기·압축)가 원재료로 읽는 에셋도 "쓰이는" 것으로 친다
TOOL_DIRS = [os.path.join(ROOT, 'tools'), os.path.join(ROOT, 'saga-web', 'tools')] +             [os.path.join(ROOT, 'saga-web', g, 'tools') for g in WEB_GAMES]
TOOL_EXT = {'.py', '.mjs', '.js', '.html', '.json', '.sh', '.gd'}
TOOL_SKIP = {'node_modules', 'out', 'asset-audit', '__pycache__'}


def load_keep():
    """keep.txt — 코드엔 안 나오지만 일부러 남기는 경로 접두어와 이유(`접두어  # 이유`)."""
    out = []
    for line in read(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'keep.txt')).splitlines():
        path, _, why = line.partition('#')
        if path.strip():
            out.append((path.strip().replace('\\', '/'), why.strip()))
    return out


def glb_uris(path):
    """GLB JSON 청크의 외부 참조(`images[].uri`·`buffers[].uri`) — Kenney 킷처럼 텍스처를 안 박는 GLB 가 있다."""
    try:
        with open(path, 'rb') as f:
            head = f.read(20)
            if head[:4] != b'glTF':
                return []
            g = json.loads(f.read(struct.unpack('<I', head[12:16])[0]).decode('utf-8'))
    except Exception:
        return []
    return [x['uri'] for k in ('images', 'buffers') for x in g.get(k, [])
            if 'uri' in x and not x['uri'].startswith('data:')]


_TOOL_TEXT = None


def tool_text():
    global _TOOL_TEXT
    if _TOOL_TEXT is None:
        _TOOL_TEXT = '\n'.join(read(p) for d in TOOL_DIRS for p in walk(d, skip=TOOL_SKIP)
                               if os.path.splitext(p)[1].lower() in TOOL_EXT and os.path.getsize(p) < 8 << 20)
    return _TOOL_TEXT


def load_code_text(t, with_tools=True):
    chunks = []
    for p in walk(t['asset_dir'], skip={'node_modules', 'Library'}):
        if p.lower().endswith('.glb'):
            chunks.extend(glb_uris(p))
    if with_tools:
        chunks.append(tool_text())
    for d in t['code_dirs']:
        for p in walk(d, skip=t['code_skip']):
            # `.glb-compress-manifest.json` 같은 처리 기록은 파일 목록일 뿐 참조가 아니다
            if os.path.basename(p).startswith('.'):
                continue
            if os.path.splitext(p)[1].lower() in t['code_ext'] and os.path.getsize(p) < 64 << 20:
                with open(p, 'rb') as f:
                    chunks.append(f.read().decode('utf-8', 'replace'))
    return '\n'.join(chunks)


def read(p):
    try:
        with open(p, 'rb') as f:
            return f.read().decode('utf-8', 'replace')
    except OSError:
        return ''


def expand_doc(doc):
    """문서의 묶음 표기를 풀어 덧붙인다 — `texture-{a,b,c,d}.png` · `CommonTree_1~5` · `Bark_DeadTree(_Normal)`."""
    extra = []
    for m in re.finditer(r'([\w./-]*)\{([\w,-]+)\}([\w./-]*)', doc):
        extra += [m.group(1) + x + m.group(3) for x in m.group(2).split(',')]
    for m in re.finditer(r'([\w./-]*?_)(\d+)\s*[~–]\s*(\d+)\b', doc):
        a, z = int(m.group(2)), int(m.group(3))
        if 0 <= z - a <= 40:
            extra += [m.group(1) + str(i) for i in range(a, z + 1)]
    for m in re.finditer(r'([\w./-]+)\(([\w-]+)\)', doc):
        extra += [m.group(1), m.group(1) + m.group(2)]
    return doc + '\n' + ' '.join(extra)


# ---------- 점검 ----------

def changed_paths():
    """작업 트리에서 바뀐(수정·새로 add·추적 안 됨) 경로 — `--quick` 이 이것만 본다."""
    out = set()
    raw = git('status', '--porcelain=v1', '-z', '--untracked-files=all', '--',
              'saga-web', 'saga-godot/assets', 'saga-unity/Assets')
    items = raw.split('\0')
    i = 0
    while i < len(items):
        e = items[i]
        if len(e) > 3:
            out.add(e[3:])
            if e[0] in 'RC':  # 이름 바꿈은 다음 칸이 옛 이름
                i += 1
        i += 1
    return out


def audit(sel, game, want_md5=True, quick=None):
    """quick=바뀐 경로 집합이면 그 파일만 🔴(public·decoder·gitsize) 위주로 빠르게 본다(커밋 훅용)."""
    t0 = time.time()
    if quick is not None:
        want_md5 = False
    tracked = {}
    for line in git('ls-files', '-s', '-z').split('\0'):
        if '\t' in line:
            tracked[line.split('\t', 1)[1]] = True
    # 점검할 에셋 폴더로만 좁힌다(저장소 전체면 30초 넘게 걸린다)
    dirs = [rel(t['asset_dir']) for t in tracks(sel, game) if os.path.isdir(t['asset_dir'])]
    if quick is not None:  # 빠른 모드는 바뀐 에셋 경로만 넘긴다(폴더 전체면 30초)
        dirs = sorted(c for c in quick if os.path.splitext(c)[1].lower() in ASSET_EXT and os.path.exists(os.path.join(ROOT, c)))
    ignored_but_tracked = set(git('ls-files', '-ci', '--exclude-standard', '--', *dirs).splitlines()) if dirs else set()
    # 추적 안 되는데 .gitignore 도 안 막는 파일 — `git add .` 한 번이면 공개 저장소에 오른다
    untracked_open = set(git('ls-files', '-o', '--exclude-standard', '--', *dirs).splitlines()) if dirs else set()

    files, issues = [], []
    global KEEP
    KEEP = load_keep()

    def issue(kind, path, msg, track):
        issues.append({'kind': kind, 'sev': SEV[kind], 'path': path, 'msg': msg, 'track': track})

    for t in tracks(sel, game):
        if not os.path.isdir(t['asset_dir']):
            continue
        tid, kind = t['id'], t['kind']
        focus = None
        if quick is not None:
            base_rel = rel(os.path.dirname(t['asset_dir'])) + '/'
            mine = {c for c in quick if c.startswith(base_rel)}
            if not mine:
                continue
            # 판 js 가 바뀌었으면 디코더 배선이 빠졌을 수 있다 → 그 판 GLB 를 전부 본다
            focus = None if kind == 'web' and any(c.startswith(base_rel + 'js/') for c in mine) else mine
        code = load_code_text(t) if quick is None else ''
        # 출처 판정용 — 옛 도구(saga-godot/tools/mixamo_retarget.gd 등)가 부르는 건 "게임이 쓴다"가 아니다
        gcode = load_code_text(dict(t, code_skip=t['code_skip'] | {'tools'}), with_tools=False) if quick is None and kind != 'web' else ''
        words = set(re.findall(r'\w+', code))  # id 접두어 대조용 — 정규식으로 코드 전체를 매번 훑으면 80초가 넘는다
        doc = expand_doc('\n'.join(read(p) for p in t['docs']).lower())
        # 문서의 `tile_*.png` 같은 와일드카드 표기도 출처 표기로 친다
        globs = [re.compile(r'(^|/)' + re.escape(g.strip('/').removeprefix('assets/')).replace(r'\*', '[^/]*') + r'(/|$)')
                 for g in re.findall(r'`([^`\s]*\*[^`\s]*)`', doc)]
        # 웹: 그 판 js 가 붙이는 디코더
        dec = set()
        if kind == 'web':
            # vendor/three 번들엔 메서드 정의가 들어 있으니 판 자체 js 에서 실제로 부르는지만 본다
            own = '\n'.join(read(q) for d in t['code_dirs'] for q in walk(d, skip=t['code_skip'] | {'vendor', 'assets'})
                            if q.endswith(('.js', '.html', '.mjs')))
            for k, pat in (('EXT_meshopt_compression', r'\.setMeshoptDecoder\('),
                           ('KHR_draco_mesh_compression', r'\.setDRACOLoader\('),
                           ('KHR_texture_basisu', r'\.setKTX2Loader\(')):
                if re.search(pat, own):
                    dec.add(k)
        skip = {'Library', 'Temp', 'Logs', 'node_modules', '_wip'} if kind != 'web' else {'node_modules'}
        all_paths = list(walk(t['asset_dir'], skip=skip))
        pathset = set(all_paths)
        lic_dirs = defaultdict(list)
        for p in all_paths:
            ext = os.path.splitext(p)[1].lower()
            rp = rel(p)
            if quick is not None and ((focus is not None and rp not in focus) or
                                      (focus is None and ext not in ('.glb', '.vrm'))):
                continue
            # 짝 점검
            if kind == 'unity' and ext == '.meta':
                tgt = p[:-5]
                if tgt not in pathset and not os.path.isdir(tgt):
                    issue('pair', rp, '고아 .meta — 짝 에셋이 없다(지우거나 에셋을 되돌린다)', tid)
                continue
            if ext in ANIM_EXT and quick is None and any(re.search(r, rp, re.I) for r in MIXAMO):
                o = origin(rp, p, ext, pathset, mixamo_ref(rp, p, kind, gcode))
                if o:
                    issue(o[0], rp, o[1], tid)
                continue
            if ext not in ASSET_EXT:
                continue
            size = os.path.getsize(p)
            rec = {'track': tid, 'path': rp, 'ext': ext, 'bytes': size, 'git': rp in tracked}
            if kind == 'unity' and p + '.meta' not in pathset:
                issue('pair', rp, '.meta 없음 — Unity 가 새 GUID 를 만들어 참조가 끊길 수 있다', tid)
            if kind == 'godot' and ext in (IMAGE | {'.glb', '.gltf', '.fbx', '.obj'} | AUDIO) and \
                    p + '.import' not in pathset and '/_mixamo_src/' not in rp:
                issue('pair', rp, '.import 없음 — 에디터로 한 번 열어 임포트 설정을 만든 뒤 함께 커밋', tid)
            if want_md5:
                rec['md5'] = md5(p)
            if ext in ('.glb', '.vrm'):
                gi = glb_info(p)
                rec.update(gi)
                if 'err' in gi:
                    issue('heavy', rp, f"GLB 이상: {gi['err']}", tid)
                if kind == 'web':
                    miss = [e for e in gi.get('gltf_ext', []) if e in
                            ('EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu')
                            and e not in dec]
                    if miss:
                        issue('decoder', rp, f"{', '.join(miss)} 로 압축됐는데 이 판 js 에 디코더 배선이 없다", tid)
                    if size > BUDGET['glb_mb'] << 20:
                        issue('heavy', rp, f"{size / 2**20:.1f}MB > {BUDGET['glb_mb']}MB (폰 첫 로드) — tools/glb-compress", tid)
                    tri_cap = PEOPLE_TRIS if ('/people/' in rp or '/characters_vroid/' in rp) else BUDGET['tris']
                    if gi.get('tris', 0) > tri_cap:
                        issue('heavy', rp, f"삼각형 {gi['tris']:,} > {tri_cap:,}", tid)
                    if gi.get('maxpx', 0) > BUDGET['tex_px']:
                        issue('heavy', rp, f"내장 텍스처 {gi['maxpx']}px > {BUDGET['tex_px']}px", tid)
            elif ext in IMAGE:
                d = image_dims(p)
                if d:
                    rec['w'], rec['h'] = d
                    if kind == 'web' and max(d) > BUDGET['tex_px']:
                        issue('heavy', rp, f"텍스처 {d[0]}×{d[1]} > {BUDGET['tex_px']}px", tid)
            # 공개 저장소 위험
            if not rec['git'] and rp in untracked_open and any(re.search(r, rp, re.I) for r in RESTRICTED):
                issue('public', rp, '재배포 금지(Mixamo 등)인데 .gitignore 가 안 막는다 — add 한 번이면 공개된다', tid)
            if rec['git']:
                if rp in ignored_but_tracked:
                    issue('public', rp, '.gitignore 가 막는 경로인데 git 에 올라가 있다(강제 add?)', tid)
                elif any(re.search(r, rp, re.I) for r in RESTRICTED):
                    issue('public', rp, '재배포 금지로 알려진 폴더(Mixamo 등)인데 git 에 올라가 있다', tid)
                if size > 100 << 20:
                    issue('gitsize', rp, f'{size / 2**20:.0f}MB — GitHub 는 100MB 초과 파일을 거부한다', tid)
                elif size > 50 << 20:
                    issue('gitsize', rp, f'{size / 2**20:.0f}MB — GitHub 50MB 경고선', tid)
            if quick is not None:
                files.append(rec)
                continue
            # 참조 흔적
            base = os.path.basename(p)
            stem = os.path.splitext(base)[0]
            ref = base in code or (len(stem) >= 4 and stem in code)
            if not ref and kind == 'unity' and os.path.exists(p + '.meta'):
                m = re.search(r'guid:\s*([0-9a-f]{32})', read(p + '.meta'))
                ref = bool(m and m.group(1) in code)
            if not ref:  # `portraits/hero/${id}.png` 처럼 폴더만 코드에 있고 파일명은 조립되는 경우
                dsegs = rp.split('/')[:-1]
                tail = '/'.join(dsegs[-2:])
                if len(dsegs) >= 2 and (tail + '/') in code:
                    ref = 'dyn'
                else:  # `eu_alexander_c.webp` ← id `eu_alexander` + 접미사, `chupchik.black.png` ← `chupchik`
                    parts = re.split(r'[._-]', stem)
                    for k in range(len(parts) - 1, 0, -1):
                        pre = stem[:len('_'.join(parts[:k]))]
                        if len(pre) >= 4 and (pre in words if re.fullmatch(r'\w+', pre) else
                                              re.search(r'(?<![\w])' + re.escape(pre) + r'(?![\w])', code)):
                            ref = 'dyn'; break
            if not ref:
                why = next((w for k, w in KEEP if rp.startswith(k)), None)
                if why is not None:
                    ref = 'keep'; rec['keep'] = why
            rec['ref'] = ref
            if kind != 'web' and ext in MODEL:
                mx = any(re.search(r, rp, re.I) for r in MIXAMO)
                o = origin(rp, p, ext, pathset, mixamo_ref(rp, p, kind, gcode) if mx else ref)
                if o:
                    issue(o[0], rp, o[1], tid)
                    rec['origin'] = o[0]
            if not ref:
                issue('unref', rp, '코드·씬에 이름/GUID 흔적 없음(동적 경로면 무시)', tid)
            # 출처 문서 대조 — 폴더 단위로 모은다
            inner = rel(p)[len(rel(t['asset_dir'])) + 1:].lower()
            segs = inner.split('/')
            names = [s for s in segs[:-1] if s not in GENERIC and len(s) >= 3]
            if len(segs) >= 3:  # people/regular/ 처럼 흔한 이름도 경로째 적혔으면 인정
                names.append('/'.join(segs[-3:-1]) + '/')
            documented = (base.lower() in doc or stem.lower() in doc or any(n in doc for n in names)
                          or any(g.search(inner) for g in globs))
            if doc and not documented and not any(m in '/' + inner for m in SELF_MADE):
                lic_dirs[os.path.dirname(rp)].append(base)
            files.append(rec)
        if doc:
            for d, names in sorted(lic_dirs.items()):
                eg = ', '.join(sorted(names)[:6]) + (' …' if len(names) > 6 else '')
                issue('license', d + '/', f'{len(names)}개 파일 — 폴더·파일 이름이 출처 문서에 한 번도 안 나온다: {eg}', tid)
        elif any(f['track'] == tid for f in files):
            issue('license', rel(t['asset_dir']) + '/', '출처 문서가 없다: ' +
                  ', '.join(rel(p) for p in t['docs']), tid)

    # 사본
    groups = defaultdict(list)
    for f in files:
        if f.get('md5') and f['bytes'] >= 4096:
            groups[f['md5']].append(f)
    dups = []
    for h, fs in groups.items():
        if len(fs) < 2:
            continue
        trk = sorted({f['track'] for f in fs})
        kinds = sorted({t.split(':')[0] for t in trk})
        dups.append({'md5': h, 'bytes': fs[0]['bytes'], 'count': len(fs), 'tracks': trk,
                     'cross_kind': len(kinds) > 1, 'wasted': fs[0]['bytes'] * (len(fs) - 1),
                     'paths': [f['path'] for f in fs]})
    dups.sort(key=lambda d: -d['wasted'])
    issues.sort(key=lambda i: (-i['sev'], i['kind'], i['track'], i['path']))
    return {'generated': time.strftime('%Y-%m-%d %H:%M'), 'seconds': round(time.time() - t0, 1),
            'budget': BUDGET, 'files': files, 'issues': issues, 'dups': dups}


# ---------- 출력 ----------

def summary(r):
    by = defaultdict(lambda: [0, 0, 0])
    for f in r['files']:
        s = by[f['track']]; s[0] += 1; s[1] += f['bytes']; s[2] += f['git']
    lines = [f"에셋 점검 {r['generated']} ({r['seconds']}s)", '',
             f"{'트랙':<18}{'파일':>7}{'용량':>10}{'git':>7}"]
    for t, (n, b, g) in sorted(by.items()):
        lines.append(f'{t:<18}{n:>7}{b / 2**20:>9.0f}M{g:>7}')
    cnt = defaultdict(int)
    for i in r['issues']:
        cnt[i['kind']] += 1
    lines += ['', '문제 ' + ' · '.join(f"{SEV_ICON[SEV[k]]}{k} {cnt[k]}" for k in sorted(cnt, key=lambda k: -SEV[k]))]
    cross = [d for d in r['dups'] if d['cross_kind']]
    lines.append(f"사본 {len(r['dups'])}묶음(낭비 {sum(d['wasted'] for d in r['dups']) / 2**20:.0f}MB) · "
                 f"트랙 넘는 사본 {len(cross)}묶음 — 공용 에셋 통합 후보")
    og = defaultdict(lambda: defaultdict(int))
    for i in r['issues']:
        if i['kind'] in ('origin', 'origin_local', 'origin_left'):
            og[i['track']][i['kind']] += 1
    if og:  # 상용 문턱(char-forge §7 단계 5, D5): 🔴origin 0 + 🔴public 0 — Mixamo 로컬 전용(🟡local)은 허용
        lines.append('출처(인물·동작) ' + ' · '.join(f"{t} 🔴{v['origin']} 🟡local {v['origin_local']} 🟡{v['origin_left']}" for t, v in sorted(og.items()))
                     + ' — 상용 문턱은 🔴 0(Mixamo 로컬 전용은 D5 허용, 공개 저장소에 오르면 🔴public)')
    for i in [i for i in r['issues'] if i['sev'] == 3][:15]:
        lines.append(f"  🔴 [{i['kind']}] {i['path']} — {i['msg']}")
    return '\n'.join(lines)


HTML = r'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>에셋 점검</title><style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a66;--line:#e4e1da;--card:#fff;--r:#c0392b;--y:#b7791f;--g:#6b6a66;--acc:#2f5d8a}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ebe9e4;--mut:#9a9892;--line:#2e2d2a;--card:#1f1e1c;--r:#ff7b6b;--y:#f0b84a;--g:#9a9892;--acc:#7fb0e0}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,"Malgun Gothic",sans-serif}
main{max-width:1200px;margin:0 auto;padding:20px 16px}h1{font-size:20px;margin:0 0 4px}.mut{color:var(--mut)}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:14px 0}
.tile{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}.tile b{display:block;font-size:20px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}nav button{border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:4px 12px;cursor:pointer}
nav button.on{background:var(--acc);color:#fff;border-color:var(--acc)}input{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg)}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--bg);cursor:pointer}td.p{word-break:break-all;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.s3{color:var(--r)}.s2{color:var(--y)}.s1{color:var(--g)}.wrap{overflow-x:auto}
</style></head><body><main><h1>에셋 점검</h1><div class="mut" id="meta"></div><div class="tiles" id="tiles"></div>
<nav id="tabs"></nav><input id="q" placeholder="경로·메시지·트랙으로 거르기"><div class="wrap"><table id="tb"></table></div></main>
<script>const R=__DATA__;const $=s=>document.querySelector(s);
const MB=b=>(b/1048576).toFixed(1)+'MB';const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('#meta').textContent=R.generated+' · '+R.files.length+'개 · '+R.seconds+'s · 예산 GLB '+R.budget.glb_mb+'MB / 삼각형 '+R.budget.tris+' / 텍스처 '+R.budget.tex_px+'px';
const by={};R.files.forEach(f=>{const t=by[f.track]||(by[f.track]={n:0,b:0});t.n++;t.b+=f.bytes});
$('#tiles').innerHTML=Object.entries(by).map(([t,v])=>`<div class="tile"><span class="mut">${t}</span><b>${v.n}</b>${MB(v.b)}</div>`).join('');
const cnt={};R.issues.forEach(i=>cnt[i.kind]=(cnt[i.kind]||0)+1);
const tabs=[['issues','문제 '+R.issues.length],['dups','사본 '+R.dups.length],['files','전체 파일'],...Object.keys(cnt).map(k=>['k:'+k,k+' '+cnt[k]])];
let cur='issues',sortK=null,sortD=1;
$('#tabs').innerHTML=tabs.map(([k,l])=>`<button data-k="${k}">${esc(l)}</button>`).join('');
$('#tabs').onclick=e=>{if(e.target.dataset.k){cur=e.target.dataset.k;sortK=null;draw()}};$('#q').oninput=draw;
function rows(){if(cur==='dups')return{h:['묶음','트랙 넘음','개수','하나 용량','낭비','경로'],r:R.dups.map(d=>[d.tracks.join(' '),d.cross_kind?'예':'',d.count,d.bytes,d.wasted,d.paths.join('\n')])};
if(cur==='files')return{h:['트랙','경로','용량','git','참조','삼각형','텍스처px','애니'],r:R.files.map(f=>[f.track,f.path,f.bytes,f.git?'o':'',f.ref===true?'o':(f.ref||''),f.tris??'',f.maxpx||(f.w?Math.max(f.w,f.h):''),f.anims??''])};
const L=cur.startsWith('k:')?R.issues.filter(i=>i.kind===cur.slice(2)):R.issues;return{h:['심각','종류','트랙','경로','내용'],r:L.map(i=>[i.sev,i.kind,i.track,i.path,i.msg])}}
function cell(h,v){if(h==='심각')return`<td class="s${v}">${['','⚪','🟡','🔴'][v]}</td>`;if(/용량|낭비/.test(h))return`<td>${MB(v)}</td>`;
return`<td class="${/경로/.test(h)?'p':''}">${esc(v).replace(/\n/g,'<br>')}</td>`}
function draw(){[...document.querySelectorAll('nav button')].forEach(b=>b.classList.toggle('on',b.dataset.k===cur));
const {h,r}=rows();const q=$('#q').value.toLowerCase();let L=q?r.filter(x=>x.join(' ').toLowerCase().includes(q)):r;
if(sortK!==null)L=[...L].sort((a,b)=>(a[sortK]>b[sortK]?1:a[sortK]<b[sortK]?-1:0)*sortD);
$('#tb').innerHTML='<tr>'+h.map((x,i)=>`<th data-i="${i}">${x}</th>`).join('')+'</tr>'+L.slice(0,3000).map(x=>'<tr>'+x.map((v,i)=>cell(h[i],v)).join('')+'</tr>').join('')
+(L.length>3000?`<tr><td colspan="${h.length}" class="mut">…${L.length-3000}줄 더(거르기로 좁히세요)</td></tr>`:'')}
$('#tb').onclick=e=>{const i=e.target.dataset.i;if(i!==undefined){sortD=sortK==+i?-sortD:1;sortK=+i;draw()}};draw();
</script></body></html>'''


def main():
    ap = argparse.ArgumentParser(description='세 트랙 에셋 점검(읽기 전용)')
    ap.add_argument('--track', action='append', choices=['web', 'godot', 'unity'])
    ap.add_argument('--game', choices=WEB_GAMES)
    ap.add_argument('--no-md5', action='store_true', help='사본 찾기를 건너뛰어 빠르게')
    ap.add_argument('--strict', action='store_true', help='🔴 가 있으면 종료 코드 1')
    ap.add_argument('--quick', action='store_true',
                    help='git 작업 트리에서 바뀐 에셋만 🔴 위주로(보고서 안 씀, precheck 용 — 🔴 면 종료 코드 1)')
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    sel = set(a.track or (['web'] if a.game else ['web', 'godot', 'unity']))
    sys.stdout.reconfigure(encoding='utf-8')
    if a.quick:
        ch = changed_paths()
        scope = os.environ.get('PRECHECK_PATHS')   # 커밋 범위(W-0075) — 같은 폴더의 남의 작업 중 에셋은 안 본다
        if scope:
            ch &= {s.strip() for s in scope.splitlines() if s.strip()}
        r = audit(sel, a.game, quick=ch)
        red = [i for i in r['issues'] if i['sev'] == 3]
        print(f"에셋 빠른 점검: 바뀐 경로 {len(ch)} · 본 에셋 {len(r['files'])} · 🔴 {len(red)} ({r['seconds']}s)")
        for i in red:
            print(f"  🔴 [{i['kind']}] {i['path']} — {i['msg']}")
        sys.exit(1 if red else 0)
    r = audit(sel, a.game, want_md5=not a.no_md5)
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False)
    with open(os.path.join(a.out, 'report.html'), 'w', encoding='utf-8') as f:
        f.write(HTML.replace('__DATA__', json.dumps(r, ensure_ascii=False).replace('</', '<\\/')))
    print(summary(r))
    print(f"\n보고서: {rel(os.path.join(a.out, 'report.html'))}")
    if a.strict and any(i['sev'] == 3 for i in r['issues']):
        sys.exit(1)


if __name__ == '__main__':
    main()
