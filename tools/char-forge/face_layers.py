"""얼굴 레이어(K-0072 단계 3) — 조합 인물(.glb)의 얼굴을 **만들지 않고** 샘플 재료만 바꿔 서로 다르게 한다.
Blender 헤드리스. 얼굴 메시는 샘플 그대로, 바꾸는 것은 ① 표정 셰이프키를 조금 섞어 기본 얼굴로 굳히기(눈매·눈썹·입)
② 텍스처 색(눈동자·피부) ③ 코드로 그리는 작은 장식(볼 홍조·주근깨·점, 볼 위치는 얼굴 메시에서 찾아 UV 로).
덤: vrm_mix 출력에서 `target_N` 으로 사라진 셰이프키 이름을 원본 VRM 의 `Fcl_*` 이름으로 되살린다(게임이 눈 깜빡임·입모양을 이름으로 찾는다).

  blender -b --factory-startup -P tools/char-forge/face_layers.py -- <in.glb> <밑몸.vrm> <out.glb> eye=1,brow=2,mouth=0,iris=3,skin=2,deco=1
    경로는 절대 경로. 칸 = eye 0~3 · brow 0~2 · mouth 0~2 · iris 0~8 · skin 0~4 · deco 0~3 (0 = 샘플 그대로).
끝 줄 FACE_OK <out> 또는 FACE_FAIL <이유>.
"""
import bpy, sys, os, json, struct, shutil, tempfile, zlib
import numpy as np
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
in_path, vrm_path, out_path = (os.path.abspath(x) for x in a[:3])
spec = {'eye': 0, 'brow': 0, 'mouth': 0, 'iris': 0, 'skin': 0, 'deco': 0}
if len(a) > 3:
    for kv in a[3].split(','):
        k, v = kv.split('=')
        spec[k] = int(v)

# 칸별 재료 — 셰이프키는 이름 끝(`Fcl_...`)으로 찾는다(샘플마다 접두가 다르다). 값은 작게: 표정이 아니라 생김새로 보일 만큼만.
EYE = [{}, {'Fcl_EYE_Angry': 0.28}, {'Fcl_EYE_Joy': 0.14, 'Fcl_EYE_Sorrow': 0.12}, {'Fcl_EYE_Surprised': 0.32}]
BROW = [{}, {'Fcl_BRW_Angry': 0.4}, {'Fcl_BRW_Sorrow': 0.4}]
MOUTH = [{}, {'Fcl_MTH_Fun': 0.22}, {'Fcl_MTH_Sorrow': 0.25}]
IRIS = [None, (24, .62, .78), (18, .5, .55), (38, .78, 1.0), (115, .5, .9), (208, .62, 1.0), (210, .12, .9), (272, .48, .95), (352, .58, .85)]  # (색상°, 채도, 밝기배) — 0 = 그대로
SKIN = [None, (244, 216, 198), (238, 200, 174), (214, 168, 132), (176, 126, 94)]    # sRGB 목표 피부(옅음·밝음·따뜻함·그을림·짙음) — 0 = 그대로


def fail(msg):
    print('FACE_FAIL', msg)
    sys.exit(1)


def vrm_face_names(path):
    b = open(path, 'rb').read()
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    for m in j['meshes']:
        t = m['primitives'][0].get('extras', {}).get('targetNames')
        if t and m['name'].lower().startswith('face'):
            return ['Fcl_' + x.split('Fcl_', 1)[1] if 'Fcl_' in x else x.split('.')[-1] for x in t]
    return []


bpy.ops.wm.read_factory_settings(use_empty=True)
tmp = os.path.join(tempfile.gettempdir(), 'fl_in.glb')
shutil.copyfile(in_path, tmp)
bpy.ops.import_scene.gltf(filepath=tmp)
face = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Face')), None)
if not face or not face.data.shape_keys:
    fail('얼굴 메시·셰이프키 없음')
kbs = face.data.shape_keys.key_blocks

# 1) 이름 되살리기 — target_i ↔ 원본 VRM 순서
names = vrm_face_names(vrm_path)
tgt = [k for k in kbs if k.name.startswith('target_')]
if names and len(tgt) == len(names):
    for k in tgt:
        k.name = names[int(k.name.split('_')[1])]
elif tgt:
    fail(f'셰이프키 수 불일치 {len(tgt)} vs {len(names)}')

# 2) 표정 섞어 굳히기 — 모든 키에 같은 변위를 더해 상대 변위(깜빡임 등)는 그대로 둔다
mix = {}
for table, key in ((EYE, 'eye'), (BROW, 'brow'), (MOUTH, 'mouth')):
    for n, w in table[spec[key] % len(table)].items():
        mix[n] = mix.get(n, 0) + w
nv = len(face.data.vertices)
basis = np.empty(nv * 3, np.float32); kbs[0].data.foreach_get('co', basis)
delta = np.zeros_like(basis)
used = []
for n, w in mix.items():
    k = next((k for k in kbs if k.name.endswith(n)), None)
    if not k:
        continue
    co = np.empty_like(basis); k.data.foreach_get('co', co)
    delta += w * (co - basis)
    used.append(n)
if used:
    for k in kbs:
        co = np.empty_like(basis); k.data.foreach_get('co', co)
        k.data.foreach_set('co', co + delta)
    face.data.update()


def mat_image(obj, key):
    for s in obj.material_slots:
        if s.material and key in s.material.name and s.material.node_tree:
            for nd in s.material.node_tree.nodes:
                if nd.type == 'TEX_IMAGE' and nd.image:
                    return nd.image
    return None


def px_get(img):
    w, h = img.size
    p = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(p)
    return p.reshape(h, w, 4)


def px_set(img, p):
    img.pixels.foreach_set(p.astype(np.float32).ravel())
    img.update()
    img.pack()


# 3) 눈동자 — 색상·채도만 바꾸고 밝기(무늬)는 둔다
if IRIS[spec['iris'] % len(IRIS)]:
    hue, sat, vk = IRIS[spec['iris'] % len(IRIS)]
    img = mat_image(face, 'EyeIris')
    if img:
        p = px_get(img)
        rgb = p[..., :3]
        mx, mn = rgb.max(-1), rgb.min(-1)
        v = np.clip(mx * vk, 0, 1)
        s0 = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0)
        s = np.clip(sat * (0.55 + 0.45 * s0), 0, 1)
        h6 = (hue / 60.0) % 6
        c = v * s
        x = c * (1 - abs(h6 % 2 - 1))
        r1, g1, b1 = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(h6)]
        m = v - c
        out = np.stack([r1 + m if np.ndim(r1) else np.full_like(v, r1) + m,
                        g1 + m if np.ndim(g1) else np.full_like(v, g1) + m,
                        b1 + m if np.ndim(b1) else np.full_like(v, b1) + m], -1)
        p[..., :3] = out
        px_set(img, p)

# 4) 피부 — 얼굴·몸 피부 텍스처를 같은 비율로(중앙값 → 목표)
tone = SKIN[spec['skin'] % len(SKIN)]
skin_imgs = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        i = mat_image(o, '_SKIN')
        if i and i not in skin_imgs:
            skin_imgs.append(i)
if tone and skin_imgs:
    fi = mat_image(face, 'Face_00_SKIN')
    ref = px_get(fi if fi in skin_imgs else skin_imgs[0])            # 기준 = 얼굴 피부(몸은 같은 비율로 따라간다)
    op = ref[..., 3] > 0.5
    med = np.median(ref[op][:, :3], axis=0) if op.any() else np.array([.9, .8, .75])
    k = np.array(tone) / 255.0 / np.maximum(med, 1e-3)
    print('SKIN med', np.round(med, 3), 'k', np.round(k, 3), [i.name for i in skin_imgs])
    for img in skin_imgs:
        p = px_get(img)
        p[..., :3] = np.clip(p[..., :3] * k, 0, 1)
        px_set(img, p)


# 5) 장식 — 볼 위치를 메시에서 찾아 그 둘레 UV 점들의 분포(평균·공분산)로 타원을 그린다
def cheek_uv_regions():
    me = face.data
    iris_idx = [i for i, s in enumerate(face.material_slots) if s.material and 'EyeIris' in s.material.name]
    skin_idx = [i for i, s in enumerate(face.material_slots) if s.material and 'Face_00_SKIN' in s.material.name]
    if not iris_idx or not skin_idx:
        return []
    co = np.array([v.co[:] for v in me.vertices])
    iv = {vi for p in me.polygons if p.material_index in iris_idx for vi in p.vertices}
    ivc = co[list(iv)]
    cx = co[:, 0].mean()
    eyes = [ivc[ivc[:, 0] < cx].mean(0), ivc[ivc[:, 0] >= cx].mean(0)]
    ed = abs(eyes[1][0] - eyes[0][0])
    fy = np.sign(np.mean([e[1] for e in eyes]) - co[:, 1].mean()) or -1.0     # 앞쪽 = 눈이 얼굴 중심보다 나온 쪽
    uv = me.uv_layers.active.data
    pts = []
    for p in me.polygons:
        if p.material_index in skin_idx:
            for li in p.loop_indices:
                pts.append((me.loops[li].vertex_index, uv[li].uv[:]))
    vi = np.array([q[0] for q in pts]); uvs = np.array([q[1] for q in pts])
    regs = []
    for e in eyes:
        t = np.array([e[0] + np.sign(e[0] - cx) * 0.12 * ed, 0, e[2] - 0.42 * ed])
        d = np.hypot(co[vi, 0] - t[0], co[vi, 2] - t[2])
        front = (co[vi, 1] - co[:, 1].mean()) * fy > 0
        sel = (d < 0.22 * ed) & front
        if sel.sum() >= 3:
            u = uvs[sel]
            regs.append((u.mean(0), np.cov(u.T) + np.eye(2) * 1e-7, u))
    return regs


deco = spec['deco'] % 4
if deco:
    img = mat_image(face, 'Face_00_SKIN')
    regs = cheek_uv_regions()
    if img and regs:
        p = px_get(img); H, W = p.shape[:2]
        yy, xx = np.mgrid[0:H, 0:W]
        uvx, uvy = (xx + 0.5) / W, (yy + 0.5) / H
        rng = np.random.default_rng(zlib.crc32(os.path.basename(out_path).encode()))
        for ri, (mu, cov, u) in enumerate(regs):
            inv = np.linalg.inv(cov)
            dx, dy = uvx - mu[0], uvy - mu[1]
            m2 = inv[0, 0] * dx * dx + 2 * inv[0, 1] * dx * dy + inv[1, 1] * dy * dy
            if deco == 1:                                             # 볼 홍조 — 부드러운 분홍
                a_ = 0.5 * np.exp(-m2 / 2.2)
                p[..., :3] = p[..., :3] * (1 - a_[..., None]) + np.array([0.93, 0.55, 0.55]) * a_[..., None]
            elif deco == 2:                                           # 주근깨 — 볼 분포 안 작은 점 여럿
                sd = np.sqrt(np.diag(cov)).mean()
                for _ in range(18):
                    c = u[rng.integers(len(u))] + rng.normal(0, sd * 0.25, 2)
                    r = sd * rng.uniform(0.1, 0.16)
                    dd = np.hypot(uvx - c[0], uvy - c[1])
                    a_ = 0.75 * np.clip(1 - dd / r, 0, 1) ** 0.6
                    p[..., :3] = p[..., :3] * (1 - a_[..., None]) + np.array([0.62, 0.40, 0.30]) * a_[..., None]
            elif deco == 3 and ri == 1:                               # 점 — 한쪽 눈 밑 하나
                sd = np.sqrt(np.diag(cov)).mean()
                c = mu + np.array([0, sd * 0.9])
                dd = np.hypot(uvx - c[0], uvy - c[1])
                a_ = 0.95 * np.clip(1 - dd / (sd * 0.13), 0, 1) ** 0.5
                p[..., :3] = p[..., :3] * (1 - a_[..., None]) + np.array([0.28, 0.18, 0.16]) * a_[..., None]
        px_set(img, p)
    elif not regs:
        print('WARN 볼 위치 못 찾음 — 장식 건너뜀')

for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.name.startswith(('Icosphere', 'Cube')):
        bpy.data.objects.remove(o, do_unlink=True)
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', export_apply=False, export_morph=True, export_skins=True,
                          use_selection=False, export_animations=False)
print('FACE_OK', out_path, spec, 'mix', used, 'keys', len(kbs))
